"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Calendar,
  Users,
  Globe,
  Camera,
  Heart,
  UserPlus,
  MessageSquare,
  Share2,
  Edit,
  CheckCircle,
  TrendingUp,
  Map as MapIcon,
  Compass,
  Bookmark,
  Info,
} from "lucide-react";

// Mock Data
const user = {
  name: "Alex Morgan",
  username: "alex_travels",
  location: "Vancouver, BC",
  bio: "Digital nomad & adventure seeker. Always looking for the next mountain to climb or street food to try. Let's explore together!",
  verified: true,
  vibes: ["Adventure", "Foodie", "Budget", "Weekend Explorer"],
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop",
  cover: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=400&fit=crop",
  stats: {
    trips: 24,
    countries: 12,
    cities: 35,
    buddies: 150,
    contributions: 45,
  },
};

const upcomingTrip = {
  title: "Alps Hiking Adventure",
  dates: "July 10 - July 20, 2026",
  location: "Switzerland",
  groupSize: 6,
  image: "https://images.unsplash.com/photo-1531210483974-4f8c1f33fd35?w=600&h=400&fit=crop",
};

const pastTrips = [
  { id: 1, title: "Tokyo City Lights", dates: "Oct 2025", location: "Japan", groupSize: 4, image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop" },
  { id: 2, title: "Bali Surf Camp", dates: "Aug 2025", location: "Indonesia", groupSize: 8, image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=300&fit=crop" },
];

const photos = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1528127269322-539801943592?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1552751753-0fc96dfcdbc7?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1513151239039-88d44b4566d7?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=400&fit=crop",
];

const bucketList = [
  { id: 1, name: "Patagonia Trek", country: "Chile", image: "https://images.unsplash.com/photo-1517411033137-0f663bc14183?w=400&h=300&fit=crop" },
  { id: 2, name: "Northern Lights", country: "Norway", image: "https://images.unsplash.com/photo-1531366930437-d3dc277aa0c6?w=400&h=300&fit=crop" },
];

const friends = [
  { id: 1, name: "Emma Watson", username: "emma_w", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", mutual: 12 },
  { id: 2, name: "John Doe", username: "johndoe", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", mutual: 5 },
];

export default function ProfileRedesignPage() {
  const [activeTab, setActiveTab] = useState("trips");

  const renderTabContent = () => {
    switch (activeTab) {
      case "trips":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-stone-800">Upcoming Trips</h3>
            <div className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className="relative h-48 w-full">
                <img src={upcomingTrip.image} alt={upcomingTrip.title} className="h-full w-full object-cover" />
                <div className="absolute top-4 right-4 rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                  Confirmed
                </div>
              </div>
              <div className="p-5">
                <h4 className="text-xl font-bold text-stone-800">{upcomingTrip.title}</h4>
                <p className="mt-1 text-sm text-stone-500">{upcomingTrip.location}</p>
                <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-teal-600" />
                    <span>{upcomingTrip.dates}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-600" />
                    <span>{upcomingTrip.groupSize} travelers</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-lg font-bold text-stone-800">Past Adventures</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {pastTrips.map((trip) => (
                <div key={trip.id} className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative h-40 w-full">
                    <img src={trip.image} alt={trip.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-stone-800">{trip.title}</h4>
                    <p className="text-xs text-stone-500">{trip.location}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-stone-600">
                      <span>{trip.dates}</span>
                      <span>{trip.groupSize} buddies</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "photos":
        return (
          <div>
            <h3 className="mb-4 text-lg font-bold text-stone-800">Travel Moments</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((src, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl bg-stone-100">
                  <img src={src} alt="Travel moment" className="h-full w-full object-cover transition-transform hover:scale-105" />
                </div>
              ))}
            </div>
          </div>
        );
      case "bucket":
        return (
          <div>
            <h3 className="mb-4 text-lg font-bold text-stone-800">Dream Destinations</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {bucketList.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative h-40 w-full">
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    <button className="absolute top-3 right-3 rounded-full bg-white/80 p-2 text-rose-500 hover:bg-white">
                      <Heart className="h-4 w-4 fill-current" />
                    </button>
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-stone-800">{item.name}</h4>
                    <p className="text-sm text-stone-500">{item.country}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "friends":
        return (
          <div>
            <h3 className="mb-4 text-lg font-bold text-stone-800">Travel Buddies</h3>
            <div className="space-y-4">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-full">
                      <img src={friend.avatar} alt={friend.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-800">{friend.name}</h4>
                      <p className="text-xs text-stone-500">@{friend.username}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{friend.mutual} mutual trips</p>
                    </div>
                  </div>
                  <button className="rounded-full border border-teal-600 px-4 py-1.5 text-xs font-semibold text-teal-600 hover:bg-teal-50">
                    Message
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case "about":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-stone-800">About Me</h3>
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">{user.bio}</p>
            </div>
            
            <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-stone-800">Travel Style</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {user.vibes.map((vibe) => (
                  <span key={vibe} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                    {vibe}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-stone-800">Fast Facts</h3>
              <ul className="mt-3 space-y-3 text-sm text-stone-600">
                <li className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-teal-600" />
                  <span>Languages: English, Spanish</span>
                </li>
                <li className="flex items-center gap-3">
                  <Compass className="h-4 w-4 text-teal-600" />
                  <span>Favorite Region: Southeast Asia</span>
                </li>
                <li className="flex items-center gap-3">
                  <Info className="h-4 w-4 text-teal-600" />
                  <span>Joined Rovvy: March 2024</span>
                </li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      {/* 1. PROFILE HERO HEADER */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-48 w-full overflow-hidden bg-stone-200 md:h-64">
          <img src={user.cover} alt="Cover" className="h-full w-full object-cover" />
        </div>

        {/* Profile Info Area */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-16 flex flex-col items-center sm:-mt-20 sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar */}
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-md sm:h-40 sm:w-40">
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            </div>

            {/* Identity & Actions */}
            <div className="mt-4 flex flex-1 flex-col items-center text-center sm:mt-0 sm:items-start sm:pb-2 sm:text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-stone-800 sm:text-3xl">{user.name}</h1>
                {user.verified && (
                  <CheckCircle className="h-5 w-5 fill-teal-600 text-white" aria-label="Verified" />
                )}
              </div>
              <p className="text-sm font-medium text-stone-500">@{user.username}</p>
              
              <div className="mt-2 flex items-center gap-1 text-sm text-stone-600">
                <MapPin className="h-4 w-4 text-teal-600" />
                <span>{user.location}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-4 flex gap-2 sm:mt-0 sm:pb-2">
              <button className="flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors shadow-sm">
                <Edit className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
              <button className="flex items-center justify-center rounded-full border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-50 transition-colors shadow-sm" aria-label="Share">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bio & Vibe Tags */}
          <div className="mt-4 max-w-3xl text-center sm:text-left">
            <p className="text-sm text-stone-600 leading-relaxed">{user.bio}</p>
            
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {user.vibes.map((vibe) => (
                <span key={vibe} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                  {vibe}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* 2. STATS ROW */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Trips Done", value: user.stats.trips, icon: Compass },
            { label: "Countries", value: user.stats.countries, icon: Globe },
            { label: "Cities", value: user.stats.cities, icon: MapPin },
            { label: "Buddies", value: user.stats.buddies, icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center rounded-2xl border border-stone-100 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow">
              <stat.icon className="h-5 w-5 text-teal-600 mb-1" />
              <div className="text-2xl font-bold text-stone-800">{stat.value}</div>
              <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 3. HIGHLIGHT STRIP */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-stone-500 uppercase tracking-wide">Spotlight</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {/* Upcoming Trip Card */}
            <div className="min-w-[280px] rounded-2xl border border-stone-100 bg-white p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                <img src={upcomingTrip.image} alt={upcomingTrip.title} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-teal-600 uppercase">Next Trip</p>
                <h3 className="truncate font-bold text-stone-800">{upcomingTrip.title}</h3>
                <p className="text-xs text-stone-500">{upcomingTrip.dates.split(" - ")[0]}</p>
              </div>
            </div>

            {/* Map Preview Card */}
            <div className="min-w-[280px] rounded-2xl border border-stone-100 bg-white p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <MapIcon className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-teal-600 uppercase">Travel Map</p>
                <h3 className="font-bold text-stone-800">{user.stats.countries} Countries</h3>
                <p className="text-xs text-stone-500">View world map →</p>
              </div>
            </div>

            {/* Contribution Score */}
            <div className="min-w-[280px] rounded-2xl border border-stone-100 bg-white p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-emerald-600 uppercase">Trust Score</p>
                <h3 className="font-bold text-stone-800">Top Organizer</h3>
                <p className="text-xs text-stone-500">{user.stats.contributions} helpful plans</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. MAIN PROFILE TABS */}
        <div className="mt-8 border-b border-stone-200">
          <nav className="flex gap-6 overflow-x-auto [scrollbar-width:none]">
            {[
              { id: "trips", label: "Trips", icon: Compass },
              { id: "photos", label: "Photos", icon: Camera },
              { id: "bucket", label: "Bucket List", icon: Bookmark },
              { id: "friends", label: "Friends", icon: Users },
              { id: "about", label: "About", icon: Info },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-teal-600 text-teal-600"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 5. TAB CONTENT */}
        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
