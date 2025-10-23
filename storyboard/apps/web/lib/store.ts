"use client";

import { create } from 'zustand'

type Panel = { i: number; caption: string; dialogue: string }

type Page = { page: number; panels: Panel[] }

type Plan = { title: string; style: string; pages: Page[] }

type State = {
  plan: Plan | null
  setPlan: (p: Plan) => void
}

export const usePlanStore = create<State>((set) => ({
  plan: null,
  setPlan: (p) => set({ plan: p })
}))
