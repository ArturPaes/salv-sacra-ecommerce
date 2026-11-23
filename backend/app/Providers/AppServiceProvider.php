<?php

namespace App\Providers;

use App\Models\Configuracao;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\MessageConverter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Mail::extend('resend', function (array $config = []) {
            $apiKey = (string) ($config['key'] ?? config('services.resend.key') ?? env('RESEND_API_KEY', ''));

            return new class($apiKey) extends AbstractTransport
            {
                public function __construct(private readonly string $apiKey)
                {
                    parent::__construct();
                }

                protected function doSend(SentMessage $message): void
                {
                    $email = MessageConverter::toEmail($message->getOriginalMessage());

                    $formatAddresses = static fn (array $addresses): array => array_map(
                        static fn (Address $addr): string => $addr->getName()
                            ? sprintf('%s <%s>', $addr->getName(), $addr->getAddress())
                            : $addr->getAddress(),
                        $addresses
                    );

                    $fromList = $formatAddresses($email->getFrom());
                    $from = $fromList[0] ?? sprintf(
                        '%s <%s>',
                        (string) config('mail.from.name', 'Salv Sacra'),
                        (string) config('mail.from.address', 'nao-responda@salvsacra.com.br')
                    );

                    // Se o remetente não pertencer ao domínio verificado no Resend, usa nao-responda@salvsacra.com.br
                    if (! str_contains(strtolower($from), '@salvsacra.com.br')) {
                        $from = sprintf('%s <nao-responda@salvsacra.com.br>', (string) config('mail.from.name', 'Salv Sacra'));
                    }

                    $replyTo = $formatAddresses($email->getReplyTo());
                    if ($replyTo === []) {
                        $replyTo = ['salvsacra2@gmail.com'];
                    }

                    $payload = array_filter([
                        'from'     => $from,
                        'to'       => array_map(static fn (Address $a): string => $a->getAddress(), $email->getTo()),
                        'cc'       => array_map(static fn (Address $a): string => $a->getAddress(), $email->getCc()),
                        'bcc'      => array_map(static fn (Address $a): string => $a->getAddress(), $email->getBcc()),
                        'reply_to' => $replyTo,
                        'subject'  => (string) $email->getSubject(),
                        'html'     => $email->getHtmlBody(),
                        'text'     => $email->getTextBody(),
                    ], static fn ($v) => $v !== null && $v !== '' && $v !== []);

                    $attachments = [];
                    foreach ($email->getAttachments() as $attachment) {
                        $attachments[] = [
                            'filename' => $attachment->getFilename() ?: 'anexo.bin',
                            'content'  => base64_encode($attachment->getBody()),
                        ];
                    }
                    if ($attachments !== []) {
                        $payload['attachments'] = $attachments;
                    }

                    $response = Http::withToken($this->apiKey)
                        ->timeout(12)
                        ->acceptJson()
                        ->post('https://api.resend.com/emails', $payload);

                    if ($response->failed()) {
                        throw new \RuntimeException('Falha ao enviar e-mail via Resend HTTP API: ' . $response->body());
                    }
                }

                public function __toString(): string
                {
                    return 'resend';
                }
            };
        });

        View::composer('emails.*', function ($view) {
            $lojaNome = 'Salv Sacra';
            $lojaSlogan = 'Vestindo a Fé com Elegância';

            try {
                if (Schema::hasTable('configuracoes')) {
                    $configs = Configuracao::whereIn('chave', ['nome_loja', 'slogan_loja'])
                        ->pluck('valor', 'chave');

                    if (! empty($configs['nome_loja'])) {
                        $lojaNome = trim((string) $configs['nome_loja']);
                    }
                    if (! empty($configs['slogan_loja'])) {
                        $lojaSlogan = trim((string) $configs['slogan_loja']);
                    }
                }
            } catch (\Throwable) {
                // Mantém os valores padrão da marca caso o banco não esteja acessível
            }

            $view->with([
                'lojaNome'   => $lojaNome,
                'lojaSlogan' => $lojaSlogan,
            ]);
        });
    }
}
