<?php

namespace App\Http\Controllers;

use App\Mail\AtivarContaMail;
use App\Mail\BoasVindasMail;
use App\Models\User;
use App\Rules\StrongPassword;
use App\Services\DemoSandboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Inicia o registro do usuário: armazena os dados pendentes e envia link de validação por e-mail.
     * A conta SÓ é criada no banco após a validação do e-mail.
     */
    public function register(Request $request): JsonResponse
    {
        $request->merge([
            'email' => trim(strtolower((string) $request->input('email', ''))),
        ]);

        $emailInformado = (string) $request->input('email', '');
        if ($emailInformado !== '') {
            $estaBloqueado = DB::table('blocked_emails')
                ->whereRaw('LOWER(email) = ?', [$emailInformado])
                ->exists()
                || User::withTrashed()
                    ->whereRaw('LOWER(email) = ?', [$emailInformado])
                    ->where('bloqueado', true)
                    ->exists();

            if ($estaBloqueado) {
                throw ValidationException::withMessages([
                    'email' => ['Este e-mail foi bloqueado pela administração e não pode ser utilizado para criar uma nova conta.'],
                ]);
            }
        }

        $isDemo = DemoSandboxService::isDemo();

        $validated = $request->validate([
            'name'                  => ['required', 'string', 'max:255'],
            'email'                 => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password'              => ['required', 'string', 'min:8', 'confirmed', new StrongPassword()],
            'recaptcha'             => [$isDemo ? 'nullable' : 'required', 'string'],
        ], [
            'name.required'         => 'Informe o seu nome completo.',
            'email.required'        => 'Informe o seu endereço de e-mail.',
            'email.email'           => 'Informe um endereço de e-mail válido.',
            'email.unique'          => 'Este e-mail já está cadastrado no sistema.',
            'password.required'     => 'Informe uma senha.',
            'password.min'          => 'A senha deve ter pelo menos 8 caracteres.',
            'password.confirmed'    => 'A confirmação de senha não confere.',
            'recaptcha.required'    => 'Por favor, confirme a verificação de segurança.',
        ]);

        if (! $isDemo) {
            $resposta = Http::withoutVerifying()
                ->asForm()
                ->post('https://www.google.com/recaptcha/api/siteverify', [
                    'secret'   => config('services.recaptcha.secret'),
                    'response' => $validated['recaptcha'],
                    'remoteip' => $request->ip(),
                ]);

            if (! $resposta->json('success')) {
                return response()->json(['message' => 'Falha na verificação do reCAPTCHA.'], 422);
            }
        }

        $email = trim(strtolower($validated['email']));

        if ($isDemo) {
            $user = User::create([
                'name'              => trim($validated['name']),
                'email'             => $email,
                'password'          => Hash::make($validated['password']),
                'papel'             => 'cliente',
                'email_verified_at' => now(),
            ]);
            if (is_null($user->email_verified_at)) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }

            DB::table('pending_registrations')->where('email', $email)->delete();
            $sanctumToken = $user->createToken('api-token')->plainTextToken;

            return response()->json([
                'message'            => 'Conta criada e ativada automaticamente no Ambiente Demo!',
                'email'              => $email,
                'user'               => $user->fresh(),
                'token'              => $sanctumToken,
                'demo_auto_verified' => true,
            ], 201);
        }

        $token = Str::random(64);

        // Salva na tabela temporária até que o usuário valide o link no e-mail
        DB::table('pending_registrations')->updateOrInsert(
            ['email' => $email],
            [
                'name'       => trim($validated['name']),
                'password'   => Hash::make($validated['password']),
                'token'      => $token,
                'created_at' => now(),
            ]
        );

        // Dispara o e-mail de ativação de conta com o link de validação
        try {
            Mail::to($email)->send(new AtivarContaMail($validated['name'], $email, $token));
        } catch (\Throwable $e) {
            Log::error('Erro ao enviar e-mail de validação de conta: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Um link de validação foi enviado para o seu e-mail.',
            'email'   => $email,
        ], 200);
    }

    /**
     * Reenvia o link de validação para um e-mail pendente.
     */
    public function reenviarValidacao(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        $email = trim(strtolower($request->email));

        $pendente = DB::table('pending_registrations')->where('email', $email)->first();
        if (! $pendente) {
            // Se já foi ativado
            if (User::where('email', $email)->exists()) {
                return response()->json(['message' => 'Esta conta já foi ativada. Você já pode fazer login.'], 400);
            }
            return response()->json(['message' => 'Nenhum cadastro pendente encontrado para este e-mail.'], 404);
        }

        $token = Str::random(64);
        DB::table('pending_registrations')->where('email', $email)->update([
            'token'      => $token,
            'created_at' => now(),
        ]);

        try {
            Mail::to($email)->send(new AtivarContaMail($pendente->name, $email, $token));
        } catch (\Throwable $e) {
            Log::error('Erro ao reenviar e-mail de validação: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Link de verificação reenviado com sucesso!']);
    }

    /**
     * Valida o token recebido no e-mail, cria oficialmente o usuário e gera o token de autenticação.
     */
    public function verificarEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
        ]);

        $email = trim(strtolower($request->email));

        $estaBloqueado = DB::table('blocked_emails')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->exists();
        if ($estaBloqueado) {
            return response()->json([
                'message' => 'Este e-mail foi bloqueado pela administração e não pode ser ativado.',
            ], 403);
        }

        $pendente = DB::table('pending_registrations')
            ->where('email', $email)
            ->where('token', $request->token)
            ->first();

        if (! $pendente) {
            // Verifica se o usuário já existe e já foi validado antes
            $usuarioExistente = User::where('email', $email)->first();
            if ($usuarioExistente && ! is_null($usuarioExistente->email_verified_at)) {
                if ($usuarioExistente->bloqueado) {
                    return response()->json([
                        'message' => 'Sua conta está bloqueada pela administração.',
                    ], 403);
                }
                $token = $usuarioExistente->createToken('api-token')->plainTextToken;
                return response()->json([
                    'message'   => 'E-mail validado com sucesso! Sua conta está ativa.',
                    'ja_ativo'  => true,
                    'token'     => $token,
                    'user'      => $usuarioExistente,
                ]);
            }

            return response()->json([
                'message' => 'O link de validação é inválido ou expirou. Solicite um novo link.',
            ], 400);
        }

        // Suporta tanto criação de nova conta quanto validação posterior de usuário já cadastrado
        $user = User::where('email', $email)->first();
        $ehNovoUsuario = false;

        if ($user) {
            if ($user->bloqueado) {
                return response()->json([
                    'message' => 'Sua conta está bloqueada pela administração.',
                ], 403);
            }
            $user->forceFill(['email_verified_at' => now()])->save();
            $user->refresh();
        } else {
            $ehNovoUsuario = true;
            $user = User::create([
                'name'              => $pendente->name,
                'email'             => $pendente->email,
                'password'          => $pendente->password,
                'email_verified_at' => now(),
            ]);
            if (is_null($user->email_verified_at)) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }
        }

        // Remove dos registros pendentes
        DB::table('pending_registrations')->where('email', $email)->delete();

        // Envia o e-mail de boas-vindas oficial apenas no primeiro cadastro
        if ($ehNovoUsuario) {
            try {
                Mail::to($user->email)->send(new BoasVindasMail($user));
            } catch (\Throwable $e) {
                Log::error('Erro ao enviar e-mail de boas-vindas: ' . $e->getMessage());
            }
        }

        // Gera token de autenticação para já entrar logado
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'message' => 'E-mail validado com sucesso! Sua conta está ativa.',
            'token'   => $token,
            'user'    => $user,
        ], 200);
    }

    /**
     * Autentica o usuário e retorna o token de acesso.
     *
     * @throws ValidationException
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ], [
            'email.required'    => 'Informe o seu endereço de e-mail.',
            'email.email'       => 'Informe um endereço de e-mail válido.',
            'password.required' => 'Informe a sua senha.',
        ]);

        $email = trim(strtolower((string) $request->input('email', '')));
        $password = (string) $request->input('password', '');

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['As credenciais fornecidas estão incorretas.'],
            ]);
        }

        if ($user->bloqueado) {
            throw ValidationException::withMessages([
                'email' => [
                    'Sua conta foi bloqueada pela administração.' .
                    ($user->bloqueado_motivo ? " Motivo: {$user->bloqueado_motivo}" : ''),
                ],
            ]);
        }

        // Contas criadas antes da nova política de segurança mantêm suas senhas antigas no banco,
        // mas não podem entrar enquanto não redefinirem para uma senha que atenda aos requisitos atuais.
        if (! StrongPassword::passes($password)) {
            throw ValidationException::withMessages([
                'email' => [
                    'Sua senha atual não atende aos novos requisitos de segurança (mínimo de 8 caracteres, letra maiúscula, letra minúscula e número). Utilize "Esqueci minha senha" para cadastrar uma nova senha.',
                ],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'message' => 'Login realizado com sucesso.',
            'token'   => $token,
            'user'    => $user,
        ]);
    }

    /**
     * Revoga o token atual do usuário autenticado.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout realizado com sucesso.',
        ]);
    }

    /**
     * Retorna os dados do usuário autenticado.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && $user->bloqueado) {
            $motivo = $user->bloqueado_motivo;
            $user->currentAccessToken()?->delete();
            return response()->json([
                'code'    => 'ACCOUNT_BLOCKED',
                'message' => 'Sua conta foi bloqueada pela administração.' . ($motivo ? " Motivo: {$motivo}" : ''),
                'motivo'  => $motivo,
            ], 403);
        }

        return response()->json([
            'user' => $user,
        ]);
    }
}
