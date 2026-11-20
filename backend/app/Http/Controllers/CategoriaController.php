<?php

namespace App\Http\Controllers;

use App\Models\Categoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoriaController extends Controller
{
    /**
     * Retorna todas as categorias disponíveis (selects e tela de administração),
     * incluindo a quantidade de produtos vinculados.
     */
    public function index(): JsonResponse
    {
        return response()->json(
            Categoria::withCount('produtos')->orderBy('nome')->get(['id', 'nome'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:100', 'unique:categorias,nome'],
        ], [
            'nome.required' => 'Informe o nome da categoria.',
            'nome.unique'   => 'Já existe uma categoria com esse nome.',
        ]);

        $categoria = Categoria::create(['nome' => trim($dados['nome'])]);
        $categoria->loadCount('produtos');

        return response()->json($categoria, 201);
    }

    public function show($id): JsonResponse
    {
        return response()->json(Categoria::withCount('produtos')->findOrFail($id));
    }

    public function update(Request $request, $id): JsonResponse
    {
        $categoria = Categoria::findOrFail($id);

        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:100', Rule::unique('categorias', 'nome')->ignore($categoria->id)],
        ], [
            'nome.required' => 'Informe o nome da categoria.',
            'nome.unique'   => 'Já existe uma categoria com esse nome.',
        ]);

        $categoria->update(['nome' => trim($dados['nome'])]);
        $categoria->loadCount('produtos');

        return response()->json($categoria);
    }

    /**
     * Impede a exclusão de categorias com produtos (a FK é cascade e apagaria os produtos).
     */
    public function destroy($id): JsonResponse
    {
        $categoria = Categoria::withCount('produtos')->findOrFail($id);

        if ($categoria->produtos_count > 0) {
            $qtd = $categoria->produtos_count;
            $plural = $qtd === 1 ? 'produto vinculado' : 'produtos vinculados';

            return response()->json([
                'message' => "Não é possível excluir a categoria \"{$categoria->nome}\" porque há {$qtd} {$plural} a ela. Altere ou exclua os produtos vinculados antes de remover este item.",
            ], 409);
        }

        $categoria->delete();

        return response()->json(['message' => 'Categoria excluída com sucesso.']);
    }
}
