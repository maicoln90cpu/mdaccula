import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Undo,
  Redo,
  Eye,
  Code,
} from 'lucide-react';
import { Label } from './label';
import { Card } from './card';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  label?: string;
}

export const RichTextEditor = ({
  content,
  onChange,
  placeholder = 'Escreva seu conteúdo aqui...',
  label = 'Conteúdo',
}: RichTextEditorProps) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const MenuButton = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      type="button"
      variant={isActive ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <Card className="overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
          <div className="border-b bg-muted/50">
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-1 flex-wrap">
                <MenuButton
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  isActive={editor.isActive('bold')}
                  title="Negrito (Ctrl+B)"
                >
                  <Bold className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  isActive={editor.isActive('italic')}
                  title="Itálico (Ctrl+I)"
                >
                  <Italic className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  isActive={editor.isActive('heading', { level: 2 })}
                  title="Título"
                >
                  <Heading2 className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  isActive={editor.isActive('bulletList')}
                  title="Lista"
                >
                  <List className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  isActive={editor.isActive('orderedList')}
                  title="Lista Numerada"
                >
                  <ListOrdered className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  isActive={editor.isActive('blockquote')}
                  title="Citação"
                >
                  <Quote className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                  isActive={editor.isActive('codeBlock')}
                  title="Bloco de Código"
                >
                  <Code className="w-4 h-4" />
                </MenuButton>
                <div className="w-px h-6 bg-border mx-1" />
                <MenuButton
                  onClick={() => editor.chain().focus().undo().run()}
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                  onClick={() => editor.chain().focus().redo().run()}
                  title="Refazer (Ctrl+Y)"
                >
                  <Redo className="w-4 h-4" />
                </MenuButton>
              </div>

              <TabsList>
                <TabsTrigger value="edit" className="text-xs">
                  Editar
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="edit" className="m-0">
            <EditorContent editor={editor} />
          </TabsContent>

          <TabsContent value="preview" className="m-0">
            <div
              className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none p-4 min-h-[300px]"
              dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
            />
          </TabsContent>
        </Tabs>
      </Card>

      <p className="text-xs text-muted-foreground">
        Suporta Markdown e atalhos de teclado (Ctrl+B, Ctrl+I, etc.)
      </p>
    </div>
  );
};
