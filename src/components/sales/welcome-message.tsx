'use client';

import { useState } from 'react';
import { X, Sparkles, UserPlus, DollarSign, Target, FolderOpen, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface WelcomeMessageProps {
  userName: string;
  onDismiss: () => void;
}

export function WelcomeMessage({ userName, onDismiss }: WelcomeMessageProps) {
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = async () => {
    if (neverShowAgain) {
      setIsDismissing(true);
      try {
        const response = await fetch('/api/sales/dismiss-welcome', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to save preference');
        }
      } catch (error) {
        toast.error('Failed to save preference');
      } finally {
        setIsDismissing(false);
      }
    }
    onDismiss();
  };

  const features = [
    {
      icon: UserPlus,
      title: 'Manage Your Leads',
      description: 'Add new prospects, track their progress through your pipeline, and schedule follow-ups.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      icon: Target,
      title: 'Visual Pipeline',
      description: 'See all your leads in a kanban-style board. Drag and drop to update their status.',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      icon: DollarSign,
      title: 'Track Commissions',
      description: 'View your pending, approved, and paid commissions. Know exactly what you\'ve earned.',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      icon: FolderOpen,
      title: 'Sales Resources',
      description: 'Access product information, brochures, and sales materials anytime.',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      icon: TrendingUp,
      title: 'Performance Metrics',
      description: 'Track your conversion rates, see trends, and measure your success.',
      color: 'text-rose-600',
      bgColor: 'bg-rose-100',
    },
  ];

  return (
    <Card className="relative overflow-hidden border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 mb-6">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        disabled={isDismissing}
        className="absolute top-4 right-4 p-1 rounded-full hover:bg-green-200/50 transition-colors"
        aria-label="Dismiss welcome message"
      >
        <X className="h-5 w-5 text-green-700" />
      </button>

      <CardContent className="pt-6 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500 rounded-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-green-800">
              Welcome to Your Sales Portal, {userName.split(' ')[0]}!
            </h2>
            <p className="text-green-700">
              We're excited to have you on the team. Here's what you can do:
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mt-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center text-center p-4 bg-white/60 rounded-lg hover:bg-white/80 transition-colors"
            >
              <div className={`p-2 ${feature.bgColor} rounded-lg mb-2`}>
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{feature.title}</h3>
              <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Getting Started Tip */}
        <div className="mt-6 p-4 bg-white/70 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-800 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Quick Start Tip
          </h3>
          <p className="text-sm text-green-700 mt-1">
            Start by adding your first lead! Click the <strong>"Add New Lead"</strong> button above or visit the{' '}
            <strong>My Leads</strong> page to get started. Every lead you convert earns you commissions!
          </p>
        </div>

        {/* Footer with checkbox */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-green-200">
          <div className="flex items-center gap-2">
            <Checkbox
              id="never-show"
              checked={neverShowAgain}
              onCheckedChange={(checked) => setNeverShowAgain(checked === true)}
            />
            <label
              htmlFor="never-show"
              className="text-sm text-green-700 cursor-pointer"
            >
              Don't show this again
            </label>
          </div>
          <Button
            onClick={handleDismiss}
            disabled={isDismissing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isDismissing ? 'Saving...' : 'Got it, let\'s go!'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
