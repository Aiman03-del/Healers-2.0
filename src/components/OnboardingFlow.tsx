import React, { useState } from 'react';
import { 
  Sparkles, Check, CheckCircle2, ChevronRight, ChevronLeft, Music4, 
  Smile, Clock, Music, Heart, AlertCircle,
  Leaf, CloudRain, Zap, Brain, Flame, Moon, Compass, Sunrise, Sun, Sunset, Headphones
} from 'lucide-react';
import { useHealersStore } from '../store';
import { toast } from 'sonner';
import { GENRES, MOODS, LISTENING_TIMES } from '../data';
import { ListeningTimePreference } from '../types';

const renderMoodIcon = (name: string, className?: string) => {
  const cn = className || "w-5 h-5";
  switch(name) {
    case 'Leaf': return <Leaf className={cn} />;
    case 'Smile': return <Smile className={cn} />;
    case 'CloudRain': return <CloudRain className={cn} />;
    case 'Zap': return <Zap className={cn} />;
    case 'Heart': return <Heart className={cn} />;
    case 'Brain': return <Brain className={cn} />;
    case 'Flame': return <Flame className={cn} />;
    case 'Sparkles': return <Sparkles className={cn} />;
    case 'Moon': return <Moon className={cn} />;
    case 'Compass': return <Compass className={cn} />;
    default: return <Sparkles className={cn} />;
  }
};

const renderTimeIcon = (value: string, className?: string) => {
  const cn = className || "w-6 h-6 text-brand-primary mb-2.5";
  switch(value) {
    case 'morning': return <Sunrise className={cn} />;
    case 'afternoon': return <Sun className={cn} />;
    case 'evening': return <Sunset className={cn} />;
    case 'night': return <Moon className={cn} />;
    case 'anytime': return <Headphones className={cn} />;
    default: return <Headphones className={cn} />;
  }
};

export const OnboardingFlow: React.FC = () => {
  const { artists, savePreferences, currentUser } = useHealersStore();
  const [step, setStep] = useState(1);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<ListeningTimePreference | null>(null);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  
  // Search query for artist filtering
  const [artistSearch, setArtistSearch] = useState('');

  // Animation trigger for completion
  const [isCompleted, setIsCompleted] = useState(false);

  const handleArtistSelect = (id: string) => {
    if (selectedArtists.includes(id)) {
      setSelectedArtists(selectedArtists.filter(item => item !== id));
    } else {
      setSelectedArtists([...selectedArtists, id]);
    }
  };

  const handleGenreSelect = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(item => item !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleMoodSelect = (mood: string) => {
    if (selectedMoods.includes(mood)) {
      setSelectedMoods(selectedMoods.filter(item => item !== mood));
    } else {
      setSelectedMoods([...selectedMoods, mood]);
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedArtists.length < 3) {
      toast.error('To customize your sound profile, please select at least 3 calming artists.');
      return;
    }
    if (step === 2 && selectedGenres.length === 0) {
      toast.error('Please select at least one genre vibe to initialize your profile.');
      return;
    }
    if (step === 3 && !selectedTime) {
      toast.error('Please select when you usually tune in to let us align the healing frequencies.');
      return;
    }
    if (step === 4 && selectedMoods.length === 0) {
      toast.error('Please select at least one mood setting for your customized home playlists.');
      return;
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      // Step 4 final submission
      setIsCompleted(true);
      setTimeout(() => {
        savePreferences({
          favorite_artists: selectedArtists,
          favorite_genres: selectedGenres,
          listening_time: selectedTime || 'anytime',
          mood: selectedMoods
        });
      }, 2500); // Allow animation to render
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Filtered artists based on query search
  const filteredArtists = artists.filter(art => 
    art.name.toLowerCase().includes(artistSearch.toLowerCase().trim())
  );

  const totalSteps = 4;
  const progressPercent = (step / totalSteps) * 100;

  if (isCompleted) {
    return (
      <div 
        id="onboarding-welcome-splash"
        className="fixed inset-0 bg-brand-bg z-50 flex flex-col items-center justify-center p-4 text-center select-none"
      >
        <div className="absolute inset-0 pointer-events-none opacity-20 filter blur-3xl wave-mesh overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary rounded-full animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary rounded-full animate-pulse delay-75"></div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md animate-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto text-brand-primary border-2 border-brand-primary/20 shadow-xl shadow-brand-primary/20 animate-bounce">
            <Music4 className="w-11 h-11" />
          </div>

          <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-white flex items-center justify-center gap-2">
            Welcome to Purple Heart <Music className="w-8 h-8 text-brand-primary shrink-0 animate-bounce" />
          </h2>
          <p className="text-gray-400 font-sans leading-relaxed text-sm">
            Hello, <span className="text-brand-secondary font-bold">{currentUser?.full_name || 'peaceful soul'}</span>! 
            We have calibrated your acoustic alignment keys. 
            Enjoy personalized therapeutic compositions, verified artists, and meditation modules curated to heal.
          </p>
          
          <div className="flex items-center justify-center gap-1.5 text-xs text-brand-secondary font-mono tracking-widest uppercase py-2">
            <Sparkles className="w-4 h-4 animate-spin text-brand-secondary" />
            Loading Harmonic Portal...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      id="onboarding-flow-screen"
      className="fixed inset-0 bg-brand-bg z-50 flex flex-col justify-between p-4 md:p-8 select-none overflow-y-auto"
    >
      {/* Top row: Brand & progress bar */}
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center font-bold shadow shadow-brand-primary/30">
              P
            </div>
            <span className="font-display font-bold text-lg text-white">Purple Heart</span>
          </div>
          
          <span className="text-xs font-mono font-bold text-gray-500">
            Step {step} of {totalSteps}
          </span>
        </div>

        {/* Custom animated progress tracker */}
        <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
          <div 
            id="onboarding-progress-indicator"
            className="h-full bg-brand-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Center column: Step views */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center py-6 md:py-10">
        
        {/* STEP 1: Favorite Artists */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300" id="onboarding-step-1">
            <div className="text-center md:text-left max-w-lg">
              <div className="inline-flex items-center gap-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full px-2.5 py-1 text-xs font-bold text-brand-primary mb-2">
                <Heart className="w-3.5 h-3.5" /> Core Sound Profile
              </div>
              <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
                Who do you love listening to?
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Select 3–5 favorite performers to tailor your customized stream. (Selected: {selectedArtists.length})
              </p>
            </div>

            {/* In-view artist search filter */}
            <div className="max-w-md">
              <input 
                id="onboarding-artist-search"
                type="text"
                placeholder="Search premium acoustic curators..."
                value={artistSearch}
                onChange={(e) => setArtistSearch(e.target.value)}
                className="w-full bg-brand-surface p-2.5 px-4 text-sm border border-gray-900 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary"
              />
            </div>

            {/* Live Artist Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {filteredArtists.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-gray-500">No curators match "{artistSearch}"</div>
              ) : (
                filteredArtists.map(art => {
                  const isSelected = selectedArtists.includes(art.id);
                  return (
                    <div 
                      key={art.id}
                      onClick={() => handleArtistSelect(art.id)}
                      className={`group relative p-3 rounded-xl border flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 hover:-translate-y-1 ${
                        isSelected 
                          ? 'bg-brand-primary/10 border-brand-primary shadow-lg shadow-brand-primary/5' 
                          : 'bg-brand-surface border-gray-900 hover:border-gray-800'
                      }`}
                    >
                      {/* Active indicator badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-brand-primary p-0.5 rounded-full text-white">
                          <Check className="w-3 h-3" />
                        </div>
                      )}

                      <img 
                        src={art.avatar_url} 
                        alt={art.name} 
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover shadow border border-gray-800" 
                      />
                      
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-100 group-hover:text-white line-clamp-1">
                          {art.name}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{art.follower_count.toLocaleString()} fans</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Core Genres */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300" id="onboarding-step-2">
            <div className="text-center md:text-left max-w-lg">
              <div className="inline-flex items-center gap-1 bg-brand-secondary/10 border border-brand-secondary/20 rounded-full px-2.5 py-1 text-xs font-bold text-brand-secondary mb-2">
                <Music4 className="w-3.5 h-3.5" /> Sonic Preferences
              </div>
              <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
                What's your vibe?
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Select your preferred musical genres (multi-select). Adjust at any time in settings.
              </p>
            </div>

            {/* Pill selections */}
            <div className="flex flex-wrap gap-2.5 max-w-4xl justify-center md:justify-start">
              {GENRES.map(genre => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    id={`onboarding-genre-${genre}`}
                    onClick={() => handleGenreSelect(genre)}
                    className={`px-4.5 py-2 rounded-full text-xs font-semibold transition-all hover:scale-103 ${
                      isSelected 
                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/10 border border-brand-primary' 
                        : 'bg-brand-surface border border-gray-900 text-gray-300 hover:border-gray-800'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Tuning times */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300" id="onboarding-step-3">
            <div className="text-center md:text-left max-w-lg">
              <div className="inline-flex items-center gap-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full px-2.5 py-1 text-xs font-bold text-brand-primary mb-2">
                <Clock className="w-3.5 h-3.5" /> Circadian Schedulers
              </div>
              <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
                When do you usually listen?
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                We will arrange soothing templates and layout greets depending on your local time.
              </p>
            </div>

            {/* Large Listening Time Panels */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-3xl">
              {LISTENING_TIMES.map(item => {
                const isSelected = selectedTime === item.value;
                return (
                  <div 
                    key={item.value}
                    onClick={() => setSelectedTime(item.value as ListeningTimePreference)}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-250 hover:-translate-y-1 ${
                      isSelected 
                        ? 'bg-brand-primary/15 border-brand-primary shadow-lg shadow-brand-primary/5' 
                        : 'bg-brand-surface border-gray-900 hover:border-gray-800'
                    }`}
                  >
                    {renderTimeIcon(item.value, "w-6 h-6 text-brand-primary mb-2.5")}
                    <span className="text-xs font-semibold text-gray-200">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Mood boards */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in duration-300" id="onboarding-step-4">
            <div className="text-center md:text-left max-w-lg">
              <div className="inline-flex items-center gap-1 bg-brand-secondary/10 border border-brand-secondary/20 rounded-full px-2.5 py-1 text-xs font-bold text-brand-secondary mb-2">
                <Smile className="w-3.5 h-3.5" /> Curative boards
              </div>
              <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight">
                What's your mood playlist?
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Select your targeted moods to generate specialized real-time playlists on your Purple Heart dashboard. (Multi-select)
              </p>
            </div>

            {/* Rich gradient mood cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-4xl">
              {MOODS.map(m => {
                const isSelected = selectedMoods.includes(m.name);
                return (
                  <div 
                    key={m.name}
                    id={`onboarding-mood-${m.name}`}
                    onClick={() => handleMoodSelect(m.name)}
                    className={`relative p-3.5 rounded-xl text-left border cursor-pointer transition-all duration-200 overflow-hidden ${
                      isSelected 
                        ? `bg-gradient-to-br ${m.gradient} border-white shadow-xl scale-103` 
                        : 'bg-brand-surface border-gray-900 hover:border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white">{renderMoodIcon(m.emoji, "w-6 h-6")}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <p className={`mt-4 font-bold text-xs ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {m.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Bottom row: Prev/Next Buttons */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between pb-2 border-t border-gray-900/60 pt-4">
        {/* Back control */}
        <button 
          id="onboarding-back-btn"
          onClick={handleBack}
          className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-lg text-xs font-bold text-gray-400 transition-colors ${
            step > 1 ? 'hover:bg-brand-surface hover:text-white cursor-pointer' : 'opacity-0 cursor-default'
          }`}
          disabled={step === 1}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Validation helpers */}
        {step === 1 && selectedArtists.length < 3 && (
          <span className="hidden md:flex items-center gap-1.5 text-xs text-brand-secondary font-mono">
            <AlertCircle className="w-3.5 h-3.5" /> Select {3 - selectedArtists.length} more artist{3 - selectedArtists.length > 1 ? 's' : ''}
          </span>
        )}

        {/* Next/Save Control */}
        <button 
          id="onboarding-next-btn"
          onClick={handleNext}
          className="flex items-center gap-2.5 px-5.5 py-2.5 rounded-lg text-xs font-bold bg-brand-primary text-white cursor-pointer hover:bg-brand-primary/95 transition-colors shadow-lg shadow-brand-primary/10"
        >
          {step === 4 ? 'Harmonize Sound Profile' : 'Next Step'} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
