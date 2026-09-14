"use client";

import {
  LIVE_DOCK_SECTION_LABEL,
  LIVE_EMPTY_STATE_TITLE,
} from "./live-design-tokens";
import type { GroupVoteOption, GroupVoteState } from "./live-group-vote-mock";
import {
  voteBarWidthPercent,
  voteDistinctVoted,
} from "./live-group-vote-mock";
import { voteStatusLabel } from "./live-group-vote-mock";

type LiveGroupVotePanelProps = {
  vote: GroupVoteState;
  statusHint?: string;
  onSelectOption: (optionId: string) => void;
  onQuickAction?: (action: "any_works" | "cant_tonight" | "add_option") => void;
};

function VoterStack({ initials }: { initials?: string[] }) {
  if (!initials?.length) return null;
  return (
    <span className="flex shrink-0 items-center">
      {initials.map((initial, index) => (
        <span
          key={`${initial}-${index}`}
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[7.5px] font-bold ${
            index === 0
              ? "bg-[#F0E5D2] text-[#7A5A22]"
              : index === 1
                ? "bg-[#E4E1F2] text-[#474079]"
                : "bg-[#DCEAE5] text-[#0A4A3E]"
          } ${index > 0 ? "-ml-1.5" : ""}`}
        >
          {initial}
        </span>
      ))}
    </span>
  );
}

function VoteOptionRow({
  option,
  memberCount,
  selected,
  onSelect,
}: {
  option: GroupVoteOption;
  memberCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const barWidth = voteBarWidthPercent(option.voteCount, memberCount);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full rounded-[13px] border-[1.5px] bg-white px-3 py-2.5 text-left transition hover:border-[#0F1614] ${
        selected ? "border-primary" : "border-[rgba(15,22,20,0.12)]"
      }`}
    >
      <span className="mb-2 flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-[#0F1614]">{option.name}</span>
          <span className="mt-0.5 block font-mono text-[9.5px] text-[#5F665F]">{option.meta}</span>
        </span>
        <VoterStack initials={option.voterInitials} />
        <span className="shrink-0 font-mono text-xs font-medium text-primary">
          {option.voteCount}/{memberCount}
        </span>
      </span>
      <span className="block h-1 overflow-hidden rounded-full bg-[#EDEAE2]">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-[#12856F] to-[#0A4A3E] transition-[width] duration-300"
          style={{ width: `${barWidth}%` }}
        />
      </span>
    </button>
  );
}

export default function LiveGroupVotePanel({
  vote,
  statusHint,
  onSelectOption,
  onQuickAction,
}: LiveGroupVotePanelProps) {
  const votedCount = voteDistinctVoted(vote);

  return (
    <div className="overflow-hidden rounded-[18px] border-[1.5px] border-[#D2453D] bg-[#FBFAF7] shadow-[0_14px_36px_-16px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between gap-2.5 border-b border-[rgba(15,22,20,0.07)] bg-[#FEF7F6] px-3.5 py-2.5">
        <span className={`flex items-center gap-1.5 ${LIVE_DOCK_SECTION_LABEL} text-[#B4453D]`}>
          <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#D2453D]" aria-hidden />
          Vote open
        </span>
        <span className="rounded-md bg-[#D2453D] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white">
          {vote.closesAtLabel}
        </span>
      </div>

      <div className="px-3.5 py-3.5">
        <h2 className={`${LIVE_EMPTY_STATE_TITLE} text-[21px]`}>{vote.question}</h2>
        <p className="mb-3.5 mt-1 text-[11.5px] text-[#5F665F]">
          {votedCount} of {vote.memberCount} voted · winner gets booked and pinned
        </p>

        <div className="mb-3 flex flex-col gap-1.5">
          {vote.options.map((option) => (
            <VoteOptionRow
              key={option.id}
              option={option}
              memberCount={vote.memberCount}
              selected={vote.myVoteId === option.id}
              onSelect={() => onSelectOption(option.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-[rgba(15,22,20,0.08)] pt-3">
          <span className={`mb-0.5 w-full ${LIVE_DOCK_SECTION_LABEL}`}>
            {statusHint ?? voteStatusLabel(vote.myVoteId)}
          </span>
          {(
            [
              ["any_works", "Any works"],
              ["cant_tonight", "Can't tonight"],
              ["add_option", "Add option"],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              type="button"
              onClick={() => onQuickAction?.(action)}
              className="rounded-full border border-[rgba(15,22,20,0.14)] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#2A312B] transition hover:border-[#0F1614]"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
