<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Demo\DemoWorkspace;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('demo:refresh {--create : Create the demo workspace when it does not exist yet}')]
#[Description('Keep the data of the demo workspace fresh')]
class RefreshDemoCommand extends Command
{
    public function handle(DemoWorkspace $demo): int
    {
        if ($this->option('create')) {
            $demo->ensure();
        } elseif (! User::query()->where('is_demo', true)->exists()) {
            return self::SUCCESS;
        }

        $demo->refresh();

        $this->info('Demo workspace refreshed.');

        return self::SUCCESS;
    }
}
