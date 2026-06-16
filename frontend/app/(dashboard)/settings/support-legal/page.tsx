"use client";

import { BookOpen, Cookie, FileText, HelpCircle, Mail, Scale, Shield, Trash2, Users2 } from "lucide-react";
import { useCallback } from "react";

import { SettingsHubRow, SettingsPageFooter, SettingsScreenHeader, SettingsSectionTitle } from "../_components";
import { SettingsBreadcrumb, hubCrumbs } from "@/components/settings/SettingsBreadcrumb";

export default function SupportLegalPage() {
  const handleDeleteAccount = useCallback(() => {
    window.alert("To delete your account, please contact privacy@rovvy.app. Our team will process your request within 30 days.");
  }, []);

  return (
    <>
      <SettingsScreenHeader title="Support & Legal" backHref="/settings" />
      <SettingsBreadcrumb crumbs={hubCrumbs("support-legal")} />

      <div className="bg-white">
        <SettingsSectionTitle>Help</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/support#help"
          icon={HelpCircle}
          label="Help Center"
          sublabel="Guides, FAQs, and how-tos"
          accentColor="pink"
        />
        <SettingsHubRow
          href="mailto:support@rovvy.app"
          icon={Mail}
          label="Contact Support"
          sublabel="Get help, report bugs, or contact the Rovvy team"
          accentColor="pink"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Legal documents</SettingsSectionTitle>
        <SettingsHubRow
          href="/privacy"
          icon={Shield}
          label="Privacy Policy"
          sublabel="How we collect and use your data"
          accentColor="pink"
        />
        <SettingsHubRow
          href="/terms"
          icon={Scale}
          label="Terms of Service"
          sublabel="Rules and agreements for using Rovvy"
          accentColor="pink"
        />
        <SettingsHubRow
          href="/cookie-policy"
          icon={Cookie}
          label="Cookie Policy"
          sublabel="How we use cookies and tracking technologies"
          accentColor="pink"
        />
        <SettingsHubRow
          href="/community-guidelines"
          icon={Users2}
          label="Community Guidelines"
          sublabel="Standards for the Rovvy community"
          accentColor="pink"
        />
        <SettingsHubRow
          icon={BookOpen}
          label="Open Source Licenses"
          sublabel="Third-party software acknowledgements"
          badge="Coming Soon"
          accentColor="pink"
        />
      </div>

      <div id="my-data" className="scroll-mt-16 bg-white">
        <SettingsSectionTitle>Your data</SettingsSectionTitle>
        <SettingsHubRow
          href="/settings/data-integrations"
          icon={FileText}
          label="Download My Data"
          sublabel="Request an archive of all your data"
          accentColor="pink"
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

      <SettingsPageFooter />
    </>
  );
}
