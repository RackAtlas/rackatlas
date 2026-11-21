<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->boolean('quiet_hours_enabled')->default(false)->after('notify_recovery');
            $table->string('quiet_from', 5)->default('22:00')->after('quiet_hours_enabled');
            $table->string('quiet_until', 5)->default('07:00')->after('quiet_from');
            $table->string('timezone', 64)->nullable()->after('quiet_until');
        });
    }

    public function down(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            $table->dropColumn(['quiet_hours_enabled', 'quiet_from', 'quiet_until', 'timezone']);
        });
    }
};
