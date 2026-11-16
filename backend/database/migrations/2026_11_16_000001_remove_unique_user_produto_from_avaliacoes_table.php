<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('avaliacoes') && Schema::hasIndex('avaliacoes', ['produto_id', 'user_id'], 'unique')) {
            Schema::table('avaliacoes', function (Blueprint $table) {
                $table->dropUnique(['produto_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('avaliacoes') && ! Schema::hasIndex('avaliacoes', ['produto_id', 'user_id'], 'unique')) {
            Schema::table('avaliacoes', function (Blueprint $table) {
                $table->unique(['produto_id', 'user_id']);
            });
        }
    }
};
