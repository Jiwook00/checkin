import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { AvatarConfig } from "../types";
import EmotionPicker, { DEFAULT_AVATAR } from "./EmotionPicker";
import EmotionBlob from "./EmotionBlob";

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
  const { id: editId } = useParams<{ id?: string }>();
  const [title, setTitle] = useState("");
  const [session, setSession] = useState(defaultSession ?? getCurrentSession());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingArticle, setLoadingArticle] = useState(!!editId);
  const [pendingContent, setPendingContent] = useState<object | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 감정 아바타 선택 — 신규 작성 시 저장 후 표시
  const [avatarPhase, setAvatarPhase] = useState(false);
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

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

  // 편집 모드: 기존 글 로드
  useEffect(() => {
    if (!editId) return;
    supabase
      .from("checkin_retrospectives")
      .select("title, session, content_markdown")
      .eq("id", editId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setTitle(data.title);
        setSession(data.session);
        try {
          setPendingContent(JSON.parse(data.content_markdown));
        } catch {
          /* no-op */
        }
        setLoadingArticle(false);
      });
  }, [editId]);

  // 에디터가 준비된 후 내용 주입
  useEffect(() => {
    if (!editor || !pendingContent) return;
    editor.commands.setContent(pendingContent);
    setPendingContent(null);
  }, [editor, pendingContent]);

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

      if (editId) {
        const { error: updateError } = await supabase
          .from("checkin_retrospectives")
          .update({
            title: title.trim(),
            session,
            content_html,
            content_markdown,
          })
          .eq("id", editId);
        if (updateError) throw new Error(updateError.message);
        onSave();
        navigate("/");
      } else {
        const { data: inserted, error: insertError } = await supabase
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
          })
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        setSavedArticleId(inserted.id);
        setAvatarPhase(true);
        setSaving(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
      setSaving(false);
    }
  };

  const handleConfirmAvatar = async () => {
    if (!savedArticleId) return;
    setSavingAvatar(true);
    try {
      const { error: updateError } = await supabase
        .from("checkin_retrospectives")
        .update({ avatar })
        .eq("id", savedArticleId);
      if (updateError) throw new Error(updateError.message);
      onSave();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
      setSavingAvatar(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      {/* 감정 아바타 선택 오버레이 */}
      {avatarPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[12px] bg-canvas p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold text-ink">
              이번 달 나의 감정은?
            </h2>
            <p className="mb-4 text-xs text-muted">
              글에 표시될 캐릭터를 자유롭게 꾸며보세요
            </p>
            {/* 미리보기 고정 */}
            <div className="flex justify-center pb-4 border-b border-hairline">
              <EmotionBlob avatar={avatar} size={72} />
            </div>
            <div className="max-h-[320px] overflow-y-auto pt-3">
              <EmotionPicker value={avatar} onChange={setAvatar} />
            </div>
            {error && (
              <p className="mt-3 rounded-[8px] bg-error/10 px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleConfirmAvatar}
              disabled={savingAvatar}
              className="mt-5 w-full rounded-[8px] bg-primary py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              {savingAvatar ? "저장 중..." : "완료"}
            </button>
          </div>
        </div>
      )}
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
          {saving ? "저장 중..." : editId ? "수정 완료" : "저장"}
        </button>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-20">
        {loadingArticle ? (
          <div className="py-20 text-center text-sm text-muted">
            불러오는 중...
          </div>
        ) : null}
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
