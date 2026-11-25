<?php

namespace App\Services\Ssh;

/**
 * What one shell script printed on a server and how it ended.
 */
final readonly class RemoteResult
{
    public function __construct(
        public string $output,
        public int $exitCode = 0,
        public string $error = '',
    ) {}

    public function ok(): bool
    {
        return $this->exitCode === 0;
    }

    /**
     * The text to show when the script failed: what it wrote to stderr, otherwise to stdout, cut short.
     */
    public function message(): string
    {
        $text = trim($this->error) !== '' ? $this->error : $this->output;
        $text = trim(mb_convert_encoding($text, 'UTF-8', 'UTF-8'));

        return mb_substr($text, 0, 800) ?: 'The command failed (exit code '.$this->exitCode.').';
    }

    /**
     * The output split at "###NAME" marker lines, as [NAME => text]. A marker may carry an argument
     * ("###JAIL sshd"), which becomes part of the key.
     *
     * @return array<string, string>
     */
    public function sections(): array
    {
        $sections = [];
        $current = null;

        foreach (preg_split('/\r\n|\n|\r/', $this->output) ?: [] as $line) {
            if (str_starts_with($line, '###')) {
                $current = trim(substr($line, 3));
                $sections[$current] ??= '';

                continue;
            }

            if ($current !== null) {
                $sections[$current] .= $line."\n";
            }
        }

        return array_map(fn (string $text) => rtrim($text, "\n"), $sections);
    }
}
