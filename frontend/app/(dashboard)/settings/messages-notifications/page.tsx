"use client";

import { Bell, BellRing, DollarSign, Mail, MessageCircle, MessageSquare, Users } from "lucide-react";
import Link from "next/link";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";

export default function MessagesNotificationsPage() {
  return (
    <>
      <SettingsScreenHeader title="Messages & Notifications" backHref="/settings" />

      <div className="bg-white">
        <SettingsSectionTitle>Messaging</SettingsSectionTitle>
        <SettingsHubRow
          href="/notifications"
          icon={MessageCircle}
          label="Rovvy Lounge"
          sublabel="Group chat and direct messages"
        />
        <SettingsHubRow
          href="/settings/interactions#messages"
          icon={MessageSquare}
          label="Message Requests"
          sublabel="Who can message you directly"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Notifications</SettingsSectionTitle>
        <SettingsHubRow
          icon={Bell}
          label="Push Notifications"
          sublabel="Trip updates, messages, invites"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Mail}
          label="Email Notifications"
          sublabel="Summaries, alerts, marketing"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Users}
          label="Group Alerts"
          sublabel="New members, votes, plan changes"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Travel alerts</SettingsSectionTitle>
        <SettingsHubRow
          icon={DollarSign}
          label="Price Alerts"
          sublabel="Notify when flight or hotel prices drop"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={BellRing}
          label="Event Alerts"
          sublabel="Events near your saved destinations"
          badge="Coming Soon"
        />
      </div>

      <div className="mx-3 mt-4 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
        <p className="text-xs text-stone-500">
          Manage device-level notification permissions in{" "}
          <Link href="/settings/app-preferences" className="font-medium text-[#0F766E] underline underline-offset-2">
            App Preferences → Device Permissions
          </Link>
        </p>
      </div>
    </>
  );
}
