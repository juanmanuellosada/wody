"use client";

import { useEffect, useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Undo2,
  Redo2,
} from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function ToolbarButton({
  onClick,
  isActive,
  label,
  children,
  disabled = false,
}: {
  onClick: () => void;
  isActive: boolean;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      disabled={disabled}
      className={[
        "p-1.5 transition-colors duration-150 cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        isActive
          ? "bg-brand-red/15 text-brand-red"
          : "text-gray-500 hover:text-white hover:bg-[#1A1A1A]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-1 h-4 w-px bg-[#2A2A2A]" />;
}

export function MarkdownEditor({
  value,
  onChange,
  disabled = false,
}: MarkdownEditorProps) {
  const [, setTick] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        bulletList: {},
        orderedList: {},
        listItem: {},
        bold: {},
        italic: {},
        hardBreak: {},
        // Disable features we don't need for WODs
        blockquote: false,
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Placeholder.configure({
        placeholder: "Escribi el WOD aca...",
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((ed.storage as any).markdown.getMarkdown());
    },
  });

  // Re-render toolbar on selection change
  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor]);

  // Sync external content changes
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentMd = (editor.storage as any).markdown.getMarkdown();
    if (currentMd !== value) {
      editor.commands.setContent(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const cmd = useCallback(
    (fn: () => void) => () => {
      fn();
      editor?.commands.focus();
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div
      className={[
        "border bg-[#1A1A1A] transition-colors duration-200",
        editor.isFocused ? "border-brand-red" : "border-[#2A2A2A]",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#2A2A2A] bg-[#0A0A0A] px-2 py-1">
        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleBold().run())}
          isActive={editor.isActive("bold")}
          label="Negrita"
        >
          <Bold size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleItalic().run())}
          isActive={editor.isActive("italic")}
          label="Italica"
        >
          <Italic size={14} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          isActive={editor.isActive("heading", { level: 1 })}
          label="Titulo 1"
        >
          <Heading1 size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          isActive={editor.isActive("heading", { level: 2 })}
          label="Titulo 2"
        >
          <Heading2 size={14} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleBulletList().run())}
          isActive={editor.isActive("bulletList")}
          label="Lista"
        >
          <List size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleOrderedList().run())}
          isActive={editor.isActive("orderedList")}
          label="Lista numerada"
        >
          <ListOrdered size={14} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().undo().run())}
          isActive={false}
          disabled={!editor.can().undo()}
          label="Deshacer"
        >
          <Undo2 size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().redo().run())}
          isActive={false}
          disabled={!editor.can().redo()}
          label="Rehacer"
        >
          <Redo2 size={14} />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        <EditorContent
          editor={editor}
          className="wody-tiptap px-4 py-3 text-sm [&_.tiptap]:outline-none [&_.tiptap]:focus:outline-none"
          style={{ minHeight: 180 }}
        />
      </div>
    </div>
  );
}
