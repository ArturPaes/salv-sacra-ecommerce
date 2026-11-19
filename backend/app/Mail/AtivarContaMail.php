<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AtivarContaMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $name;
    public string $email;
    public string $verificationUrl;
    public bool $isEmailChange;

    /**
     * Create a new message instance.
     */
    public function __construct(string $name, string $email, string $token, bool $isEmailChange = false)
    {
        $this->name = $name;
        $this->email = $email;
        $this->isEmailChange = $isEmailChange;
        $frontendUrl = config('app.frontend_url');
        $this->verificationUrl = rtrim($frontendUrl, '/') . '/verificar-email?token=' . urlencode($token) . '&email=' . urlencode($email);
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->isEmailChange
                ? 'Confirme seu novo endereço de e-mail - Salv Sacra'
                : 'Valide seu e-mail para ativar sua conta - Salv Sacra',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.ativar_conta',
        );
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        return [];
    }
}
