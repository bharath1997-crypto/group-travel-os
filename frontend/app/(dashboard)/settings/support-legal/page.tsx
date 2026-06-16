"use client";

import { BookOpen, Cookie, FileText, HelpCircle, Mail, Scale, Shield, Trash2, Users2 } from "lucide-react";
import { useCallback } from "react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";

export default function SupportLegalPage() {
  const handleDeleteAccount = useCallback(() => {
    window.alert("To delete your account, please contact privacy@rovvy.app. Our team will process your request within 30 days.");
  }, []);

  return (
    <>
      <SettingsScreenHeader title="Support & Legal" backHref="/settings" />

      <div className="bg-white">
        <SettingsSectionTitle>Help</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/support#help"
          icon={HelpCircle}
          label="Help Center"
          sublabel="Guides, FAQs, and how-tos"
        />
        <SettingsHubRow
          href="mailto:support@rovvy.app"
          icon={Mail}
          label="Contact Support"
          sublabel="Get help, report bugs, or contact the Rovvy team"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Legal documents</SettingsSectionTitle>
        <SettingsHubRow
          href="/privacy"
          icon={Shield}
          label="Privacy Policy"
          sublabel="How we collect and use your data"
        />
        <SettingsHubRow
          href="/terms"
          icon={Scale}
          label="Terms of Service"
          sublabel="Rules and agreements for using Rovvy"
        />
        <SettingsHubRow
          href="/cookie-policy"
          icon={Cookie}
          label="Cookie Policy"
          sublabel="How we use cookies and tracking technologies"
        />
        <SettingsHubRow
          icon={Users2}
          label="Community Guidelines"
          sublabel="Standards for the Rovvy community"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={BookOpen}
          label="Open Source Licenses"
          sublabel="Third-party software acknowledgements"
          badge="Coming Soon"
        />
      </div>

      <div id="my-data" className="scroll-mt-16 bg-white">
        <SettingsSectionTitle>Your data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations"
          icon={FileText}
          label="Download My Data"
          sublabel="Request an archive of all your data"
        />
      </div>

      <div className="mt-6 bg-white">
        <SettingsSectionTitle>Account actions</SettingsSectionTitle>
        <SettingsHubRow
          icon={Trash2}
          label="Delete Account"
          sublabel="Permanently remove your account and data subject to applicable retention policies."
          danger
          onClick={handleDeleteAccount}
        />
      </div>

      {/* Footer branding */}
      <div className="mt-8 px-4 pb-2 text-center">
        <p className="text-[11px] text-stone-400">Rovvy v2.0 &bull; Group Travel OS</p>
        <p className="mt-1 text-[11px] text-stone-400">
          <a href="/privacy" className="hover:text-stone-600 hover:underline">Privacy</a>
          {" \u2022 "}
          <a href="/terms" className="hover:text-stone-600 hover:underline">Terms</a>
          {" \u2022 "}
          <a href="/cookie-policy" className="hover:text-stone-600 hover:underline">Cookies</a>
        </p>
      </div>
    </>
  );
}
