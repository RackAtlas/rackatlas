<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * A change on a server that was refused or failed, with the message for the user. A 409 that asks for
 * confirmation means the change is possible but risky: the page asks and sends it again with `confirmed`.
 */
class RemoteCommandException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 422,
        public readonly bool $needsConfirmation = false,
    ) {
        parent::__construct($message);
    }

    public static function confirm(string $message): self
    {
        return new self($message, 409, true);
    }

    public static function conflict(string $message): self
    {
        return new self($message, 409);
    }
}
