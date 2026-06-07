# Guia de Contribuição - FinBot

Obrigado por considerar contribuir com o FinBot! Este documento fornece diretrizes para contribuir com o projeto de forma eficiente e colaborativa.

## Código de Conduta

Ao participar deste projeto, você concorda em manter um ambiente respeitoso e inclusivo para todos. Esperamos que todos os contribuidores:

- Sejam respeitosos e profissionais em todas as interações
- Aceitem críticas construtivas com mente aberta
- Foquem no que é melhor para a comunidade
- Demonstrem empatia com outros membros da comunidade

## Como Posso Contribuir?

### Reportando Bugs

Bugs são rastreados como issues do GitHub. Ao criar uma issue de bug, inclua:

**Informações Essenciais:**
- Título claro e descritivo
- Descrição detalhada do problema
- Passos específicos para reproduzir o bug
- Comportamento esperado vs. comportamento atual
- Screenshots ou GIFs (se aplicável)
- Informações do ambiente (SO, versão do Node.js, Python, etc.)

**Exemplo de Issue de Bug:**

```markdown
## Descrição
OCR falha ao processar imagens de recibos em formato PNG

## Passos para Reproduzir
1. Faça upload de um recibo em formato PNG
2. Clique em "Processar Documento"
3. Observe o erro no console

## Comportamento Esperado
O OCR deve extrair os dados do recibo corretamente

## Comportamento Atual
Erro: "Unsupported image format"

## Ambiente
- OS: Ubuntu 22.04
- Node.js: 22.0.0
- Python: 3.11.0
- Tesseract: 4.1.1
```

### Sugerindo Melhorias

Sugestões de melhorias também são rastreadas como issues. Ao criar uma issue de melhoria, inclua:

- Descrição clara da melhoria proposta
- Justificativa (por que essa melhoria é útil?)
- Casos de uso específicos
- Possíveis abordagens de implementação
- Impacto esperado no projeto

### Contribuindo com Código

#### Configuração do Ambiente de Desenvolvimento

1. **Fork o repositório** no GitHub

2. **Clone seu fork localmente:**
```bash
git clone https://github.com/seu-usuario/finbot.git
cd finbot
```

3. **Adicione o repositório original como upstream:**
```bash
git remote add upstream https://github.com/original/finbot.git
```

4. **Instale as dependências:**
```bash
# Node.js
pnpm install

# Python
pip3 install -r requirements.txt

# Tesseract OCR
sudo apt-get install tesseract-ocr tesseract-ocr-por
```

5. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
# Edite .env com suas chaves de API
```

6. **Execute as migrações do banco de dados:**
```bash
pnpm db:push
```

7. **Inicie o servidor de desenvolvimento:**
```bash
pnpm dev
```

#### Fluxo de Trabalho Git

1. **Crie uma branch para sua feature:**
```bash
git checkout -b feature/nome-da-feature
```

Convenções de nomenclatura de branches:
- `feature/` - Nova funcionalidade
- `fix/` - Correção de bug
- `docs/` - Mudanças na documentação
- `refactor/` - Refatoração de código
- `test/` - Adição ou correção de testes

2. **Faça suas mudanças e commit:**
```bash
git add .
git commit -m "feat: adiciona categorização automática de gastos"
```

Siga o padrão [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Mudanças na documentação
- `style:` - Formatação de código
- `refactor:` - Refatoração
- `test:` - Testes
- `chore:` - Tarefas de manutenção

3. **Mantenha sua branch atualizada:**
```bash
git fetch upstream
git rebase upstream/main
```

4. **Push para seu fork:**
```bash
git push origin feature/nome-da-feature
```

5. **Abra um Pull Request** no GitHub

#### Diretrizes de Código

**TypeScript/JavaScript:**
- Use TypeScript sempre que possível
- Siga as configurações do ESLint e Prettier
- Prefira `const` sobre `let`, evite `var`
- Use arrow functions para callbacks
- Adicione tipos explícitos em funções públicas
- Documente funções complexas com JSDoc

**Python:**
- Siga PEP 8 para estilo de código
- Use type hints em funções
- Documente funções com docstrings
- Mantenha funções pequenas e focadas
- Use nomes descritivos para variáveis

**Exemplos de Boas Práticas:**

```typescript
// ✅ Bom
async function getUserTransactions(
  userId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date));
}

// ❌ Evite
function getStuff(id) {
  var db = getDb()
  return db.select().from(transactions).where(eq(transactions.userId, id))
}
```

```python
# ✅ Bom
def extract_boleto_data(image_path: str) -> Dict[str, Any]:
    """
    Extrai dados específicos de um boleto.
    
    Args:
        image_path: Caminho da imagem do boleto
        
    Returns:
        Dicionário com dados do boleto
    """
    text = self.extract_text(image_path)
    return self._parse_boleto_text(text)

# ❌ Evite
def extract(path):
    t = self.extract_text(path)
    return self._parse(t)
```

#### Testes

Sempre adicione testes para novas funcionalidades:

**Frontend (Vitest):**
```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency', () => {
  it('should format BRL currency correctly', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
  });
});
```

**Backend (Python):**
```python
import unittest
from server.services.ocr_service import OCRService

class TestOCRService(unittest.TestCase):
    def test_extract_text(self):
        service = OCRService()
        result = service.extract_text('test_image.jpg')
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 0)
```

Execute os testes antes de fazer commit:
```bash
# Frontend
pnpm test

# Backend
python3 -m pytest
```

#### Documentação

Atualize a documentação quando necessário:

- **README.md** - Para mudanças em funcionalidades principais
- **Comentários no código** - Para lógica complexa
- **JSDoc/Docstrings** - Para funções públicas
- **CHANGELOG.md** - Para mudanças significativas

### Pull Requests

#### Checklist antes de Submeter

- [ ] Código segue as diretrizes de estilo
- [ ] Testes foram adicionados/atualizados
- [ ] Todos os testes passam
- [ ] Documentação foi atualizada
- [ ] Commits seguem Conventional Commits
- [ ] Branch está atualizada com main

#### Template de Pull Request

```markdown
## Descrição
Breve descrição das mudanças realizadas

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Breaking change
- [ ] Documentação

## Como Testar
1. Passo 1
2. Passo 2
3. Verificar resultado esperado

## Screenshots (se aplicável)
[Adicione screenshots aqui]

## Checklist
- [ ] Código segue diretrizes de estilo
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Sem breaking changes (ou documentados)
```

#### Processo de Review

1. Mantenedores revisarão seu PR
2. Podem solicitar mudanças ou esclarecimentos
3. Faça as mudanças solicitadas e push para a mesma branch
4. Após aprovação, seu PR será merged

## Estrutura do Projeto

Entenda a estrutura antes de contribuir:

```
finbot/
├── client/               # Frontend React
│   ├── src/
│   │   ├── pages/       # Páginas da aplicação
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── lib/         # Utilitários
│   │   └── App.tsx      # Rotas principais
│   └── public/          # Assets estáticos
├── server/              # Backend Node.js
│   ├── services/        # Serviços Python
│   ├── routers.ts       # Endpoints tRPC
│   ├── db.ts            # Queries do banco
│   └── _core/           # Infraestrutura
├── drizzle/             # Schemas do banco
│   └── schema.ts        # Definições de tabelas
└── docs/                # Documentação
```

## Áreas que Precisam de Ajuda

Estamos especialmente interessados em contribuições nas seguintes áreas:

### Frontend
- [ ] Dashboard financeiro com gráficos interativos
- [ ] Componente de chat multimodal
- [ ] Upload e preview de documentos
- [ ] Visualizações de orçamento vs. gastos
- [ ] Interface mobile responsiva

### Backend
- [ ] Endpoints tRPC para todas as funcionalidades
- [ ] Sistema de filas para processamento assíncrono
- [ ] Integração com mais fontes de notícias
- [ ] API de webhooks para integrações

### Mobile
- [ ] Aplicativo React Native
- [ ] Scanner de documentos com câmera
- [ ] Sincronização offline
- [ ] Notificações push

### Infraestrutura
- [ ] CI/CD com GitHub Actions
- [ ] Testes automatizados
- [ ] Monitoramento e logging
- [ ] Performance optimization

### Documentação
- [ ] Tutoriais em vídeo
- [ ] Exemplos de uso avançado
- [ ] Tradução para outros idiomas
- [ ] Guias de deploy

## Comunidade

Junte-se à nossa comunidade:

- **GitHub Discussions** - Para perguntas e discussões gerais
- **Issues** - Para bugs e sugestões
- **Pull Requests** - Para contribuições de código

## Reconhecimento

Todos os contribuidores serão reconhecidos no README.md e terão seus nomes listados na seção de contribuidores.

## Dúvidas?

Se tiver dúvidas sobre como contribuir, sinta-se à vontade para:
- Abrir uma issue com a tag `question`
- Perguntar nas GitHub Discussions
- Entrar em contato com os mantenedores

---

**Obrigado por contribuir com o FinBot! 🚀**
