<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use Illuminate\Http\Request;

/** Personal API tokens (Pro), scoped by ability "org:{id}" so a token only works for that organization. */
class ApiTokenController extends Controller
{
    public function index(Request $request, Organization $org)
    {
        return $request->user()->tokens()->where('abilities', 'like', '%"org:'.$org->id.'"%')->get(['id', 'name', 'last_used_at', 'created_at']);
    }

    public function store(Request $request, Organization $org)
    {
        $name = $request->validate(['name' => 'required|string|max:100|not_in:web'])['name'];
        $token = $request->user()->createToken($name, ['org:'.$org->id]);

        return response()->json(['id' => $token->accessToken->id, 'name' => $name, 'token' => $token->plainTextToken], 201);
    }

    public function destroy(Request $request, Organization $org, int $id)
    {
        $request->user()->tokens()->whereKey($id)->where('abilities', 'like', '%"org:'.$org->id.'"%')->delete();

        return response()->noContent();
    }
}
