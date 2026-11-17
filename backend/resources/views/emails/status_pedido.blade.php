<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atualização do Pedido - Salv Sacra</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: #111111; padding: 28px 20px;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 3px; font-weight: 700; text-transform: uppercase;">{{ strtoupper($lojaNome ?? 'SALV SACRA') }}</h1>
                            <p style="margin: 6px 0 0; color: #c4953a; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500;">{{ $lojaSlogan ?? 'Vestindo a Fé com Elegância' }}</p>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 36px 32px;">
                            <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #111111;">
                                Atualização do seu Pedido #{{ $pedido->id }}
                            </h2>
                            <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #444444;">
                                Olá, {{ $pedido->user?->name ?? 'Cliente' }}! O status do seu pedido foi atualizado para:
                            </p>

                            <!-- Status Box -->
                            <div style="background-color: #f8f9fa; border-left: 4px solid #111111; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px;">
                                <p style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #777777;">Status Atual:</p>
                                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #111111;">{{ $pedido->status }}</p>
                                @if(!empty($pedido->codigo_rastreio))
                                    <p style="margin: 10px 0 0; font-size: 13px; color: #333333; padding-top: 10px; border-top: 1px solid #e9ecef;">
                                        📦 <strong>Código de Rastreio:</strong>
                                        <a href="https://rastreamento.correios.com.br/app/index.php?codigo={{ urlencode(trim($pedido->codigo_rastreio)) }}" target="_blank" style="font-family: monospace; font-weight: bold; background: #eeeeee; padding: 3px 8px; border-radius: 4px; color: #0044cc; text-decoration: underline; margin-left: 4px;">
                                            {{ $pedido->codigo_rastreio }} ↗
                                        </a>
                                    </p>
                                @endif
                                @if(!empty($pedido->tipo_frete))
                                    <p style="margin: 6px 0 0; font-size: 12px; color: #666666;">
                                        Modalidade de envio: {{ $pedido->tipo_frete }}
                                    </p>
                                @endif
                            </div>

                            @if($pedido->itens && $pedido->itens->count() > 0)
                                <!-- Resumo dos Produtos Comprados -->
                                <div style="background-color: #fafafa; border: 1px solid #eeeeee; border-radius: 6px; padding: 18px 20px; margin-bottom: 24px;">
                                    <div style="font-weight: 700; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #333333;">
                                        Itens do Pedido
                                    </div>

                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                                        @php $subtotalItens = 0; @endphp
                                        @foreach($pedido->itens as $item)
                                            @php
                                                $produtoNome = $item->variacao?->produto?->nome ?? 'Produto';
                                                $detalhesVar = array_filter([
                                                    $item->variacao?->tamanho ? 'Tam: ' . $item->variacao->tamanho : null,
                                                    $item->variacao?->cor ?? null,
                                                ]);
                                                $totalItem = (float) ($item->preco_unitario ?? 0) * (int) ($item->quantidade ?? 1);
                                                $subtotalItens += $totalItem;
                                            @endphp
                                            <tr>
                                                <td style="padding: 9px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; color: #222222; vertical-align: top;">
                                                    <strong>{{ $item->quantidade }}x</strong> {{ $produtoNome }}
                                                    @if(!empty($detalhesVar))
                                                        <div style="color: #777777; font-size: 12px; margin-top: 2px;">
                                                            {{ implode(' · ', $detalhesVar) }}
                                                        </div>
                                                    @endif
                                                </td>
                                                <td align="right" style="padding: 9px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; font-weight: 600; color: #111111; white-space: nowrap; vertical-align: top;">
                                                    R$ {{ number_format($totalItem, 2, ',', '.') }}
                                                </td>
                                            </tr>
                                        @endforeach
                                    </table>

                                    @php
                                        $valorFrete = (float) ($pedido->valor_frete_pago ?? $pedido->valor_frete ?? 0);
                                        $valorDescontoCupom = (float) ($pedido->valor_desconto_cupom ?? 0);
                                        $valorValeCompra = (float) ($pedido->valor_vale_compra ?? 0);
                                    @endphp

                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 12px; font-size: 13px; color: #555555;">
                                        <tr>
                                            <td style="padding: 3px 0;">Subtotal dos produtos</td>
                                            <td align="right" style="padding: 3px 0;">R$ {{ number_format($subtotalItens, 2, ',', '.') }}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 3px 0;">Frete{{ !empty($pedido->tipo_frete) ? ' (' . $pedido->tipo_frete . ')' : '' }}</td>
                                            <td align="right" style="padding: 3px 0;">{{ $valorFrete > 0 ? 'R$ ' . number_format($valorFrete, 2, ',', '.') : 'Grátis' }}</td>
                                        </tr>
                                        @if($valorDescontoCupom > 0)
                                            <tr>
                                                <td style="padding: 3px 0; color: #166534;">Desconto{{ !empty($pedido->cupom_codigo) ? ' (' . $pedido->cupom_codigo . ')' : '' }}</td>
                                                <td align="right" style="padding: 3px 0; color: #166534;">- R$ {{ number_format($valorDescontoCupom, 2, ',', '.') }}</td>
                                            </tr>
                                        @endif
                                        @if($valorValeCompra > 0)
                                            <tr>
                                                <td style="padding: 3px 0; color: #166534;">Vale-compra aplicado</td>
                                                <td align="right" style="padding: 3px 0; color: #166534;">- R$ {{ number_format($valorValeCompra, 2, ',', '.') }}</td>
                                            </tr>
                                        @endif
                                        <tr>
                                            <td style="padding: 10px 0 0; font-size: 15px; font-weight: 700; color: #111111; border-top: 1px solid #e5e7eb;">Total do Pedido</td>
                                            <td align="right" style="padding: 10px 0 0; font-size: 15px; font-weight: 700; color: #111111; border-top: 1px solid #e5e7eb;">R$ {{ number_format($pedido->valor_total ?? 0, 2, ',', '.') }}</td>
                                        </tr>
                                    </table>
                                </div>
                            @endif

                            @if($pedido->status === 'Entregue')
                                <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #333333;">
                                    Seu pacote foi entregue com sucesso! Esperamos que as peças tenham correspondido a todas as suas expectativas.
                                </p>

                                <!-- Box de Avaliação com Destaque -->
                                <div style="background-color: #faf8f2; border: 1.5px solid #d4ac0d; border-radius: 8px; padding: 24px 20px; text-align: center; margin-bottom: 28px;">
                                    <h3 style="margin: 0 0 8px; font-size: 17px; font-weight: 700; color: #111111;">
                                        ⭐ O que achou do seu produto?
                                    </h3>
                                    <p style="margin: 0 0 18px; font-size: 13px; color: #555555; line-height: 1.5;">
                                        Sua avaliação ajuda outros clientes a escolherem a melhor peça e garante seu selo de <strong>Compra Verificada</strong>. Leva menos de 1 minuto!
                                    </p>
                                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                                        <tr>
                                            <td align="center" style="background-color: #111111; border-radius: 6px;">
                                                <a href="{{ $avaliarUrl }}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.5px; text-transform: uppercase;">
                                                    ⭐ Avaliar Meus Produtos
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <p style="margin: 0 0 20px; font-size: 13px; text-align: center; color: #666666;">
                                    Ou se preferir, você também pode <a href="{{ $minhaContaUrl }}" target="_blank" style="color: #111111; font-weight: 600; text-decoration: underline;">ver todos os detalhes do seu pedido</a>.
                                </p>
                            @else
                                <p style="margin: 0 0 28px; font-size: 14px; line-height: 1.6; color: #555555;">
                                    Você pode acompanhar todos os detalhes e a evolução da sua compra diretamente na sua área de cliente.
                                </p>

                                <!-- CTA Button -->
                                <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 28px;">
                                    <tr>
                                        <td align="center" style="background-color: #111111; border-radius: 6px;">
                                            <a href="{{ $minhaContaUrl }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 1px; text-transform: uppercase;">
                                                Acompanhar Pedido
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            @endif

                            <div style="margin: 0; font-size: 13px; line-height: 1.7; color: #666666; border-top: 1px solid #eeeeee; padding-top: 18px;">
                                @php
                                    $metodoPagLabel = match (strtolower((string) ($pedido->metodo_pagamento ?? ''))) {
                                        'pix' => 'PIX',
                                        'cartao', 'cartao_credito' => !empty($pedido->cartao_parcelas)
                                            ? "Cartão de Crédito ({$pedido->cartao_parcelas}x)"
                                            : 'Cartão de Crédito',
                                        'vale_compra' => 'Vale-Compra',
                                        default => strtoupper((string) ($pedido->metodo_pagamento ?? 'PIX')),
                                    };
                                @endphp
                                <div>Total do pedido: <strong style="color: #111111;">R$ {{ number_format($pedido->total ?? $pedido->valor_total ?? 0, 2, ',', '.') }}</strong></div>
                                <div>Forma de pagamento: <strong style="color: #111111;">{{ $metodoPagLabel }}</strong></div>
                                @if(!empty($pedido->logradouro))
                                    <div>
                                        Entrega: {{ $pedido->logradouro }}{{ !empty($pedido->numero) ? ', ' . $pedido->numero : '' }}{{ !empty($pedido->complemento) ? ' (' . $pedido->complemento . ')' : '' }} — {{ $pedido->bairro ?? '' }}, {{ $pedido->cidade ?? '' }}/{{ $pedido->estado ?? '' }} · CEP {{ $pedido->cep ?? '' }}
                                    </div>
                                @endif
                                <div>Data da compra: {{ $pedido->created_at ? $pedido->created_at->format('d/m/Y H:i') : '-' }}</div>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #fafafa; padding: 20px; border-top: 1px solid #eeeeee;">
                            <p style="margin: 0; font-size: 12px; color: #999999;">
                                © {{ date('Y') }} {{ $lojaNome ?? 'Salv Sacra' }} · {{ $lojaSlogan ?? 'Vestindo a Fé com Elegância' }}. Todos os direitos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>

