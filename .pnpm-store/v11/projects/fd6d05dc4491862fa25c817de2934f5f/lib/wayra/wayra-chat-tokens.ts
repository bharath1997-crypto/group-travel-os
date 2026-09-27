/**
 * Global Wayra Chrome panel — prototype shell (Instrument Serif + warm paper).
 */

export const WAYRA_PANEL_BASE =
  "pointer-events-auto fixed z-[3000] flex flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-[#F7F6F3] shadow-[0_24px_60px_-24px_rgba(15,22,20,0.45)]";

export const WAYRA_PANEL_DOCKED = `${WAYRA_PANEL_BASE} rounded-none rounded-l-[28px] border-r-0`;

export const WAYRA_HEADER =
  "relative flex shrink-0 items-center justify-between gap-3 bg-[#F7F6F3] px-4 pb-2 pt-3.5";

export const WAYRA_HEADER_ACCENT = "hidden";

export const WAYRA_HEADER_BODY = "flex min-w-0 flex-1 items-center gap-2.5";

export const WAYRA_AVATAR_SHELL =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F3D32] text-white";

export const WAYRA_TITLE = "font-sans text-[15px] font-semibold tracking-tight text-[#0F1614]";

export const WAYRA_STATUS =
  "mt-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-[#6B7280]";

export const WAYRA_PIN_BADGE =
  "max-w-[10rem] truncate rounded-full bg-[#E8F3EE] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#0F3D32]";

export const WAYRA_HEADER_FOOTER = "hidden";

export const WAYRA_MODE_TOGGLE = "hidden";

export const WAYRA_MODE_BTN_ACTIVE = "";

export const WAYRA_MODE_BTN_IDLE = "";

export const WAYRA_HEADER_BTN =
  "flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-black/[0.04] hover:text-[#0F1614] focus:outline-none";

export const WAYRA_MESSAGES =
  "min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F7F6F3] px-4 py-2";

export const WAYRA_EMPTY_CARD = "";

export const WAYRA_SYSTEM_MSG =
  "py-1 text-center font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]";

export const WAYRA_USER_BUBBLE =
  "rounded-full bg-[#141414] px-4 py-3 text-[14px] leading-snug text-white";

export const WAYRA_USER_TIME = "hidden";

export const WAYRA_ASSISTANT_CARD = "space-y-3";

export const WAYRA_ASSISTANT_BODY =
  "rounded-[22px] bg-[#E8F3EE] px-4 py-3.5 text-[14.5px] leading-relaxed whitespace-pre-wrap text-[#0F1614]";

export const WAYRA_ASSISTANT_META = "space-y-2";

export const WAYRA_ASSISTANT_TIME = "hidden";

export const WAYRA_PENDING =
  "rounded-[22px] bg-[#E8F3EE] px-4 py-3.5 text-[14px] text-[#3F4A46]";

export const WAYRA_PENDING_SPINNER =
  "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0F3D32]/20 border-t-[#0F3D32]";

export const WAYRA_ACTION_PILL =
  "rounded-full bg-[#0F3D32] px-5 py-3 text-[13px] font-semibold text-white transition hover:brightness-110 focus:outline-none disabled:opacity-50";

export const WAYRA_SOURCE_PILL = "";

export const WAYRA_FOLLOWUP_PILL =
  "w-full rounded-full border border-black/[0.06] bg-white px-4 py-3 text-left text-[13.5px] text-[#0F1614] transition hover:bg-[#EFEDE8] focus:outline-none disabled:opacity-50";

export const WAYRA_SECTION_LABEL =
  "mb-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]";

export const WAYRA_FOOTER = "shrink-0 bg-[#F7F6F3] px-4 pb-4 pt-2";

export const WAYRA_COMPOSER_ROW = "flex items-center gap-2";

export const WAYRA_COMPOSER_BOX =
  "flex min-h-[48px] flex-1 items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2 py-1.5";

export const WAYRA_ICON_BTN =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:text-[#0F3D32] focus:outline-none";

export const WAYRA_ICON_BTN_ACTIVE =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F3EE] text-[#0F3D32]";

export const WAYRA_INPUT =
  "max-h-24 min-h-[32px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-snug text-[#0F1614] placeholder:text-[#9CA3AF] focus:outline-none";

export const WAYRA_SEND_BTN =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F3D32] text-white transition hover:brightness-110 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40";

export const WAYRA_ATTACH_MENU =
  "absolute bottom-full left-0 z-30 mb-1 min-w-[168px] overflow-hidden rounded-2xl border border-black/[0.06] bg-white py-1 shadow-lg";

export const WAYRA_ATTACH_CHIP =
  "mb-2 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px]";

export const WAYRA_HINT = "text-[11px] leading-snug text-[#6B7280]";

export const WAYRA_HINT_WARN = "text-[11px] leading-snug text-amber-700";

export const WAYRA_INTERIM = "hidden";

export const WAYRA_TRY_LABEL =
  "mb-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]";

export const WAYRA_TRY_CHIP =
  "flex w-full items-center gap-3 rounded-full border border-black/[0.06] bg-white px-4 py-3 text-left text-[14px] leading-snug text-[#0F1614] transition hover:bg-[#EFEDE8]";

export const WAYRA_TRY_CHIP_MUTED =
  "flex w-full items-center gap-3 rounded-full bg-[#EFEDE8] px-4 py-3 text-left text-[14px] leading-snug text-[#6B7280]";

export const WAYRA_HEADLINE =
  "font-display text-[28px] leading-[1.15] tracking-[-0.03em] text-[#0F1614]";

export const WAYRA_SUBHEAD = "mt-2 text-[14.5px] leading-relaxed text-[#6B7280]";

export const WAYRA_PLACE_CARD =
  "flex w-full items-center gap-3 rounded-[20px] border border-black/[0.04] bg-white px-3 py-3 text-left transition hover:bg-[#EFEDE8]";
