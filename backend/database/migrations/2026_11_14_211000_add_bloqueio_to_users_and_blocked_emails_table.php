<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'bloqueado')) {
                $table->boolean('bloqueado')->default(false)->after('papel');
            }
            if (! Schema::hasColumn('users', 'bloqueado_motivo')) {
                $table->text('bloqueado_motivo')->nullable()->after('bloqueado');
            }
            if (! Schema::hasColumn('users', 'bloqueado_em')) {
                $table->timestamp('bloqueado_em')->nullable()->after('bloqueado_motivo');
            }
        });

        if (! Schema::hasTable('blocked_emails')) {
            Schema::create('blocked_emails', function (Blueprint $table) {
                $table->id();
                $table->string('email')->unique();
                $table->text('motivo')->nullable();
                $table->foreignId('blocked_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        // Libera e-mails de contas já excluídas (soft-deleted) pelo admin antes desta correção
        $excluidosSemPrefixo = DB::table('users')
            ->whereNotNull('deleted_at')
            ->where('bloqueado', false)
            ->where('email', 'not like', 'desativado_%')
            ->get(['id', 'email']);

        foreach ($excluidosSemPrefixo as $row) {
            DB::table('users')
                ->where('id', $row->id)
                ->update(['email' => 'desativado_' . $row->id . '_' . $row->email]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('blocked_emails');

        Schema::table('users', function (Blueprint $table) {
            $cols = array_filter(['bloqueado', 'bloqueado_motivo', 'bloqueado_em'], fn ($c) => Schema::hasColumn('users', $c));
            if (! empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
