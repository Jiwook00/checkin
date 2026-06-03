import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function getCurrentSession(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface WritePageProps {
  memberId: string;
  defaultSession?: string;
  onSave: () => void;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`tiptap-toolbar-btn${active ? " is-active" : ""}`}
    >
      {children}
    </button>
  );
}

export default function WritePage({
  memberId,
  defaultSession,
  onSave,
}: WritePageProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [session, setSession] = useState(defaultSession ?? getCurrentSession());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: "회고 글을 작성하세요..." }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: {
      attributes: {
        class: "tiptap focus:outline-none min-h-[400px]",
      },
    },
  });

  const handleImageFile = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "png";
    const uuid = crypto.randomUUID();
    const path = `write-editor/${memberId}/${uuid}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("checkin-images")
      .upload(path, file);
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from("checkin-images").getPublicUrl(path);
    editor?.chain().focus().setImage({ src: data.publicUrl }).run();
  };

  const handleSetLink = () => {
    const prev = editor?.getAttributes("link").href ?? "";
    const url = window.prompt("링크 URL을 입력하세요", prev);
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("제목을 입력해주세요");
      return;
    }
    if (!editor || editor.isEmpty) {
      setError("내용을 입력해주세요");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const content_html = editor.getHTML();
      const content_markdown = JSON.stringify(editor.getJSON());
      const { error: insertError } = await supabase
        .from("checkin_retrospectives")
        .insert({
          member_id: memberId,
          title: title.trim(),
          session,
          content_type: "written",
          content_html,
          content_markdown,
          source_url: null,
          source_type: "other",
        });
      if (insertError) throw new Error(insertError.message);
      onSave();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-canvas px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-sm text-muted transition-colors hover:text-body"
        >
          ← 뒤로
        </button>
        <div className="flex-1" />
        {error && <span className="text-xs text-error">{error}</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-[8px] bg-primary px-4 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-20">
        {/* 제목 */}
        <input
          type="text"
          placeholder="제목을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-8 w-full border-none bg-transparent text-2xl font-bold text-ink placeholder:text-muted focus:outline-none"
        />

        {/* 회차 */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted">회차</span>
          <input
            type="text"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="w-24 rounded border border-hairline bg-surface-card px-2 py-0.5 text-xs text-body focus:border-ink focus:outline-none"
          />
        </div>

        {/* 툴바 */}
        <div className="mt-6 flex flex-wrap items-center gap-1 rounded-[8px] border border-hairline bg-surface-card px-2 py-1.5">
          <ToolbarButton
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="굵게 (Ctrl+B)"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="기울임 (Ctrl+I)"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            title="밑줄 (Ctrl+U)"
          >
            <span className="underline">U</span>
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-hairline" />

          <ToolbarButton
            active={editor?.isActive("heading", { level: 1 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
            title="제목 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
            title="제목 2"
          >
            H2
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-hairline" />

          <ToolbarButton
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            title="글머리 기호"
          >
            • 목록
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            title="번호 목록"
          >
            1. 목록
          </ToolbarButton>

          <span className="mx-1 h-4 w-px bg-hairline" />

          <ToolbarButton
            active={editor?.isActive("link")}
            onClick={handleSetLink}
            title="링크"
          >
            링크
          </ToolbarButton>
          <ToolbarButton
            onClick={() => imageInputRef.current?.click()}
            title="이미지 업로드"
          >
            이미지
          </ToolbarButton>
        </div>

        {/* 에디터 */}
        <div className="tiptap-editor-wrapper mt-4">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            await handleImageFile(file);
          } catch (err) {
            setError(err instanceof Error ? err.message : "이미지 업로드 실패");
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
