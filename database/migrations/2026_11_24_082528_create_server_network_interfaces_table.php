<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_network_interfaces', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_network_sample_id')->constrained()->cascadeOnDelete();
            $table->string('name', 32);
            // Bytes and packets per second, errors and dropped packets per second.
            $table->unsignedBigInteger('rx_bps');
            $table->unsignedBigInteger('tx_bps');
            $table->unsignedBigInteger('rx_pps');
            $table->unsignedBigInteger('tx_pps');
            $table->float('errors');
            $table->float('drops');

            $table->index('server_network_sample_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_network_interfaces');
    }
};
