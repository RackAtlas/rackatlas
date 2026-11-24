<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_network_samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->timestamp('collected_at');
            $table->unsignedInteger('tcp_established')->nullable();
            $table->unsignedInteger('tcp_syn_recv')->nullable();
            $table->unsignedInteger('tcp_time_wait')->nullable();
            $table->unsignedInteger('tcp_close_wait')->nullable();
            $table->unsignedInteger('tcp_listen')->nullable();
            // Per second, averaged over the time since the previous report. Null on the first report.
            $table->float('tcp_in_segs')->nullable();
            $table->float('tcp_out_segs')->nullable();
            $table->float('tcp_retrans_segs')->nullable();
            $table->float('tcp_in_errs')->nullable();
            $table->float('tcp_attempt_fails')->nullable();
            $table->float('tcp_estab_resets')->nullable();
            $table->float('tcp_active_opens')->nullable();
            $table->float('tcp_passive_opens')->nullable();
            $table->unsignedInteger('conntrack_count')->nullable();
            $table->unsignedInteger('conntrack_max')->nullable();

            $table->index(['server_id', 'collected_at']);
            $table->index('collected_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_network_samples');
    }
};
