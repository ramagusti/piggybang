<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Services\OcrService;
use Illuminate\Http\Request;

class OcrController extends Controller
{
    public function receipt(Request $request, Organization $org)
    {
        $file = $request->validate(['image' => 'required|image|max:5120'])['image'];

        return OcrService::extract($file->getRealPath(), $file->getMimeType());
    }
}
