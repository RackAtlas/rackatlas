<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AppFeedbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }
}
