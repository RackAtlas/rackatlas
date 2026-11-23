<?php

namespace App\Http\Requests\Terminal;

use Illuminate\Foundation\Http\FormRequest;

class TerminalSnippetRequest extends FormRequest
{
    public function authorize(): bool
    {
        $team = $this->user()->currentTeam();

        return $team !== null && $this->user()->can('permit', [$team, 'terminal.edit']);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        if ($this->isMethod('DELETE')) {
            return [];
        }

        return [
            'name' => ['required', 'string', 'max:80'],
            'command' => ['required', 'string', 'max:4000'],
        ];
    }
}
