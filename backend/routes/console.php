<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\DemoSandboxService;
use App\Services\RastreioService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('pedidos:sincronizar-rastreio', function (RastreioService $rastreioService) {
    $this->info('Iniciando sincronização de rastreios dos Correios / Melhor Envio...');
    $resumo = $rastreioService->sincronizarTodos();
    $this->info("Concluído: {$resumo['total_atualizados']} de {$resumo['total_verificados']} pedidos atualizados.");
})->purpose('Consulta e sincroniza o status de entrega dos pedidos em transporte');

Artisan::command('demo:limpar-sessoes', function () {
    $removidas = DemoSandboxService::cleanupAbandonedSessions(7);
    $this->info("Sessões Demo expiradas removidas: {$removidas}.");
})->purpose('Remove sessões Demo abandonadas há mais de 7 dias');

Schedule::command('pedidos:sincronizar-rastreio')->hourly();
Schedule::command('demo:limpar-sessoes')->daily();
