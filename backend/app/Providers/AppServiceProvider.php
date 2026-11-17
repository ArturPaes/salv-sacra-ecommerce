<?php

namespace App\Providers;

use App\Models\Configuracao;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

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
