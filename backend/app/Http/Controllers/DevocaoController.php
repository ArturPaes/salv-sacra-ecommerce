<?php

namespace App\Http\Controllers;

use App\Models\Devocao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DevocaoController extends Controller
{
    /**
     * Retorna todas as devoções (selects e tela de administração),
     * incluindo a quantidade de produtos vinculados.
     */
    public function index(): JsonResponse
    {
        return response()->json(
            Devocao::withCount('produtos')->orderBy('nome')->get(['id', 'nome'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:100', 'unique:devocaos,nome'],
        ], [
            'nome.required' => 'Informe o nome da devoção.',
            'nome.unique'   => 'Já existe uma devoção com esse nome.',
        ]);

        $devocao = Devocao::create(['nome' => trim($dados['nome'])]);
        $devocao->loadCount('produtos');

        return response()->json($devocao, 201);
    }

    public function show($id): JsonResponse
    {
        return response()->json(Devocao::withCount('produtos')->findOrFail($id));
    }

    public function update(Request $request, $id): JsonResponse
    {
        $devocao = Devocao::findOrFail($id);

        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:100', Rule::unique('devocaos', 'nome')->ignore($devocao->id)],
        ], [
            'nome.required' => 'Informe o nome da devoção.',
            'nome.unique'   => 'Já existe uma devoção com esse nome.',
        ]);

        $devocao->update(['nome' => trim($dados['nome'])]);
        $devocao->loadCount('produtos');

        return response()->json($devocao);
    }

    /**
     * Impede a exclusão de devoções com produtos (a FK é cascade e apagaria os produtos).
     */
    public function destroy($id): JsonResponse
    {
        $devocao = Devocao::withCount('produtos')->findOrFail($id);

        if ($devocao->produtos_count > 0) {
            $qtd = $devocao->produtos_count;
            $plural = $qtd === 1 ? 'produto vinculado' : 'produtos vinculados';

            return response()->json([
                'message' => "Não é possível excluir a devoção \"{$devocao->nome}\" porque há {$qtd} {$plural} a ela. Altere ou exclua os produtos vinculados antes de remover este item.",
            ], 409);
        }

        $devocao->delete();

        return response()->json(['message' => 'Devoção excluída com sucesso.']);
    }
}
