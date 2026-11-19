<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            if (! Schema::hasColumn('produtos', 'preco_oversized')) {
                $table->decimal('preco_oversized', 10, 2)->nullable()->default(90.00)->after('preco_base');
            }
            if (! Schema::hasColumn('produtos', 'destaque')) {
                $table->boolean('destaque')->default(false)->after('disponivel');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'pending_email')) {
                $table->string('pending_email')->nullable()->after('email');
            }
            if (! Schema::hasColumn('users', 'pending_email_token')) {
                $table->string('pending_email_token')->nullable()->after('pending_email');
            }
        });

        // Atualiza todas as camisetas existentes para Regular Fit R$ 80,00 e Oversized R$ 90,00
        DB::table('produtos')->update([
            'preco_base'      => 80.00,
            'preco_oversized' => 90.00,
        ]);

        // Marca os primeiros 8 produtos como destaque inicial caso nenhum esteja destacado
        if (DB::table('produtos')->where('destaque', true)->count() === 0) {
            $idsIniciais = DB::table('produtos')->orderBy('id')->limit(8)->pluck('id')->all();
            if (! empty($idsIniciais)) {
                DB::table('produtos')->whereIn('id', $idsIniciais)->update(['destaque' => true]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            if (Schema::hasColumn('produtos', 'preco_oversized')) {
                $table->dropColumn('preco_oversized');
            }
            if (Schema::hasColumn('produtos', 'destaque')) {
                $table->dropColumn('destaque');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'pending_email_token')) {
                $table->dropColumn('pending_email_token');
            }
            if (Schema::hasColumn('users', 'pending_email')) {
                $table->dropColumn('pending_email');
            }
        });
    }
};
