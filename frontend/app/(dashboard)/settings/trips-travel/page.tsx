"use client";

import {
  Award, Briefcase, Car, FileText, Fuel,
  MapPin, Plane, Route, Star, Users, Zap,
} from "lucide-react";

import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../_components";

export default function TripsTravelPage() {
  return (
    <>
      <SettingsScreenHeader title="Trips & Travel" backHref="/settings" />

      <div className="bg-white">
        <SettingsSectionTitle>Group settings</SettingsSectionTitle>
        <SettingsHubRow
          icon={Users}
          label="Trip Invitations"
          sublabel="Manage who can invite you to trips"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Users}
          label="Group Permissions"
          sublabel="What group members can see and do"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Star}
          label="Trusted Travelers"
          sublabel="Close contacts for faster trip joining"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Travel profile</SettingsSectionTitle>
        <SettingsHubRow
          icon={Plane}
          label="Travel Preferences"
          sublabel="Seat, meal, hotel, and activity preferences"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={FileText}
          label="Travel Documents"
          sublabel="Passport, visa, ID — stored securely"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Award}
          label="Loyalty Programs"
          sublabel="Airlines, hotels, and rewards cards"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Briefcase}
          label="Booking Preferences"
          sublabel="Defaults for flights, hotels, activities"
          badge="Coming Soon"
        />
      </div>

      <div className="bg-white">
        <SettingsSectionTitle>Driver & Transportation</SettingsSectionTitle>
        <SettingsHubRow
          icon={Car}
          label="Driver Profile"
          sublabel="Set up your driver settings"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Car}
          label="Vehicle Information"
          sublabel="Car details and preferences"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Fuel}
          label="Fuel Preferences"
          sublabel="Petrol, diesel, or hybrid"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Zap}
          label="EV Charging"
          sublabel="Charging networks and preferences"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={Route}
          label="Route Preferences"
          sublabel="Toll, highways, scenic routes"
          badge="Coming Soon"
        />
        <SettingsHubRow
          icon={MapPin}
          label="Road Trip Mode"
          sublabel="Optimised routing for long drives"
          badge="Coming Soon"
        />
      </div>
    </>
  );
}
