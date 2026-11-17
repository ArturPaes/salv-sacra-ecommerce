<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Produto extends Model
{
    protected $fillable = [
        'nome',
        'descricao',
        'preco_base',
        'imagem_url',
        'imagens',
        'imagens_vitrine',
        'cores_config',
        'disponivel',
        'colecao',
        'modelo',
        'categoria_id',
        'devocao_id',
    ];

    protected $casts = [
        'preco_base'      => 'decimal:2',
        'disponivel'      => 'boolean',
        'imagens'         => 'array',
        'imagens_vitrine' => 'array',
        'cores_config'    => 'array',
    ];

    // ─── Relações ────────────────────────────────────────────────────────────

    public function variacoes(): HasMany
    {
        return $this->hasMany(Variacao::class);
    }

    public function itemPedidos(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(ItemPedido::class, Variacao::class, 'produto_id', 'variacao_produto_id');
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class);
    }

    public function devocao(): BelongsTo
    {
        return $this->belongsTo(Devocao::class);
    }

    public function avaliacoes(): HasMany
    {
        return $this->hasMany(Avaliacao::class);
    }

    public function favoritos(): HasMany
    {
        return $this->hasMany(Favorito::class);
    }

    /**
     * Normaliza URLs de imagens salvas com localhost:8000 para o APP_URL atual em produção.
     */
    public function toArray(): array
    {
        $array = parent::toArray();
        $appUrl = rtrim((string) config('app.url', 'http://localhost:8000'), '/');

        if ($appUrl !== '' && ! str_contains($appUrl, 'localhost:8000')) {
            $normalizar = function ($valor) use (&$normalizar, $appUrl) {
                if (is_string($valor)) {
                    return preg_replace('#^https?://(localhost|127\.0\.0\.1):8000/storage/#i', $appUrl . '/storage/', $valor);
                }
                if (is_array($valor)) {
                    foreach ($valor as $k => $v) {
                        $valor[$k] = $normalizar($v);
                    }
                }
                return $valor;
            };

            foreach (['imagem_url', 'imagens', 'imagens_vitrine', 'cores_config'] as $campo) {
                if (isset($array[$campo])) {
                    $array[$campo] = $normalizar($array[$campo]);
                }
            }
        }

        return $array;
    }
}
