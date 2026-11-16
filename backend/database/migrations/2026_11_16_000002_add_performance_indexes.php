<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('variacaos') && ! Schema::hasIndex('variacaos', ['produto_id'])) {
            Schema::table('variacaos', function (Blueprint $table) {
                $table->index('produto_id');
            });
        }

        if (Schema::hasTable('pedidos')) {
            if (! Schema::hasIndex('pedidos', ['user_id', 'created_at'])) {
                Schema::table('pedidos', function (Blueprint $table) {
                    $table->index(['user_id', 'created_at']);
                });
            }
            if (! Schema::hasIndex('pedidos', ['status'])) {
                Schema::table('pedidos', function (Blueprint $table) {
                    $table->index('status');
                });
            }
        }

        if (Schema::hasTable('item_pedidos')) {
            if (! Schema::hasIndex('item_pedidos', ['pedido_id'])) {
                Schema::table('item_pedidos', function (Blueprint $table) {
                    $table->index('pedido_id');
                });
            }
            if (! Schema::hasIndex('item_pedidos', ['variacao_produto_id'])) {
                Schema::table('item_pedidos', function (Blueprint $table) {
                    $table->index('variacao_produto_id');
                });
            }
        }

        if (Schema::hasTable('avaliacoes')) {
            if (! Schema::hasIndex('avaliacoes', ['produto_id'])) {
                Schema::table('avaliacoes', function (Blueprint $table) {
                    $table->index('produto_id');
                });
            }
            if (! Schema::hasIndex('avaliacoes', ['user_id'])) {
                Schema::table('avaliacoes', function (Blueprint $table) {
                    $table->index('user_id');
                });
            }
        }

        if (Schema::hasTable('produtos')) {
            if (! Schema::hasIndex('produtos', ['disponivel', 'categoria_id'])) {
                Schema::table('produtos', function (Blueprint $table) {
                    $table->index(['disponivel', 'categoria_id']);
                });
            }
            if (! Schema::hasIndex('produtos', ['devocao_id'])) {
                Schema::table('produtos', function (Blueprint $table) {
                    $table->index('devocao_id');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('variacaos') && Schema::hasIndex('variacaos', ['produto_id'])) {
            Schema::table('variacaos', fn (Blueprint $table) => $table->dropIndex(['produto_id']));
        }
        if (Schema::hasTable('pedidos')) {
            if (Schema::hasIndex('pedidos', ['user_id', 'created_at'])) {
                Schema::table('pedidos', fn (Blueprint $table) => $table->dropIndex(['user_id', 'created_at']));
            }
            if (Schema::hasIndex('pedidos', ['status'])) {
                Schema::table('pedidos', fn (Blueprint $table) => $table->dropIndex(['status']));
            }
        }
        if (Schema::hasTable('item_pedidos')) {
            if (Schema::hasIndex('item_pedidos', ['pedido_id'])) {
                Schema::table('item_pedidos', fn (Blueprint $table) => $table->dropIndex(['pedido_id']));
            }
            if (Schema::hasIndex('item_pedidos', ['variacao_produto_id'])) {
                Schema::table('item_pedidos', fn (Blueprint $table) => $table->dropIndex(['variacao_produto_id']));
            }
        }
        if (Schema::hasTable('avaliacoes')) {
            if (Schema::hasIndex('avaliacoes', ['produto_id'])) {
                Schema::table('avaliacoes', fn (Blueprint $table) => $table->dropIndex(['produto_id']));
            }
            if (Schema::hasIndex('avaliacoes', ['user_id'])) {
                Schema::table('avaliacoes', fn (Blueprint $table) => $table->dropIndex(['user_id']));
            }
        }
        if (Schema::hasTable('produtos')) {
            if (Schema::hasIndex('produtos', ['disponivel', 'categoria_id'])) {
                Schema::table('produtos', fn (Blueprint $table) => $table->dropIndex(['disponivel', 'categoria_id']));
            }
            if (Schema::hasIndex('produtos', ['devocao_id'])) {
                Schema::table('produtos', fn (Blueprint $table) => $table->dropIndex(['devocao_id']));
            }
        }
    }
};
