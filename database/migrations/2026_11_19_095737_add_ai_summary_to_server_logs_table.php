<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('server_logs', function (Blueprint $table) {
            $table->text('ai_summary')->nullable()->after('message');
            $table->string('ai_model', 64)->nullable()->after('ai_summary');
        });
    }

    public function down(): void
    {
        Schema::table('server_logs', function (Blueprint $table) {
            $table->dropColumn(['ai_summary', 'ai_model']);
        });
    }
};
