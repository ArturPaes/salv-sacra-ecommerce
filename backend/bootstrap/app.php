<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => \App\Http\Middleware\CheckAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            $bearer = $request->bearerToken();
            if ($bearer) {
                $plain = str_contains($bearer, '|') ? explode('|', $bearer, 2)[1] : $bearer;
                $hash = hash('sha256', $plain);
                $blocked = Cache::get("blocked_token:{$hash}");

                if (is_array($blocked)) {
                    $motivo = $blocked['motivo'] ?? null;
                    return response()->json([
                        'code'    => 'ACCOUNT_BLOCKED',
                        'message' => 'Sua conta foi bloqueada pela administração.' . ($motivo ? " Motivo: {$motivo}" : ''),
                        'motivo'  => $motivo,
                    ], 403);
                }
            }

            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        });
    })->create();
