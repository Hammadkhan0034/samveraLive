import React, { useState } from 'react';
import { 
  Users, 
  Building2, 
  LayoutDashboard, 
  FileText, 
  Utensils, 
  Image as ImageIcon, 
  BarChart3, 
  AlertTriangle, 
  AlertOctagon, 
  Calendar, 
  FlaskConical, 
  Settings, 
  Edit3, 
  Download,
  MapPin,
  Maximize2,
  Minimize2,
  Menu as MenuIcon,
  X,
  GraduationCap,
  UsersRound,
  Layers,
  Baby
} from 'lucide-react';

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
    {children}
  </div>
);

// Reverted StatBadge to original neutral background with colored icon/text
const StatBadge = ({ label, value, subtext, icon: Icon, colorClass = "text-blue-600 bg-blue-50" }) => (
  <div className="flex items-start space-x-4 p-4 rounded-lg bg-white border border-slate-200 h-full transition-transform hover:scale-[1.02] duration-200 shadow-sm">
    <div className={`p-3 rounded-lg ${colorClass}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h3 className="text-xl font-bold text-slate-900">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  </div>
);

// Reverted NavTile to original styling
const NavTile = ({ title, subTitle, icon: Icon, color, onClick }) => (
  <button 
    onClick={onClick}
    className="group flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-lg hover:border-blue-500 transition-all duration-200 h-40 w-full text-center relative overflow-hidden"
  >
    <div className={`absolute top-0 left-0 w-full h-1 ${color}`}></div>
    <div className={`p-4 rounded-full mb-3 ${color.replace('bg-', 'bg-opacity-10 text-').replace('600', '600').replace('500', '500')}`}>
      <Icon size={32} className={`text-slate-700 group-hover:scale-110 transition-transform duration-200`} />
    </div>
    <h3 className="font-semibold text-slate-800 group-hover:text-blue-700">{title}</h3>
    {subTitle && <span className="text-xs text-slate-400 mt-1">{subTitle}</span>}
  </button>
);

// --- Main Application ---

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Mock Data for the School
  const [schoolData, setSchoolData] = useState({
    name: "Samvera Leikskóli",
    type: "Preschool / Leikskóli",
    kennitala: "540298-2209",
    address: "Borgartún 10, 105 Reykjavík",
    totalFloorArea: 1200, // m2
    playArea: 450, // m2
    maxCapacity: 150,
    enrolledCount: 138,
    guardiansCount: 265,
    teachersCount: 24,
    classesCount: 8,
    mediaCount: 1240
  });

  // Derived calculations
  const sqMetersPerChild = (schoolData.totalFloorArea / schoolData.enrolledCount).toFixed(2);
  const capacityPercentage = Math.round((schoolData.enrolledCount / schoolData.maxCapacity) * 100);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    // Reverted background color to standard slate-50
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
      
      {/* Sidebar Navigation - Reverted to original compact style */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:w-20 lg:hover:w-64 group`}>
        <div className="flex items-center justify-between p-4 h-16 border-b border-slate-700">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="bg-blue-500 p-2 rounded-lg min-w-[32px]">
              <LayoutDashboard size={20} className="text-white" />
            </div>
            <span className="font-bold text-lg whitespace-nowrap opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 lg:opacity-0 transition-opacity duration-300">Samvera</span>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="p-4 space-y-2">
          <a href="#" className="flex items-center space-x-3 p-3 bg-blue-600 rounded-lg text-white">
            <LayoutDashboard size={24} className="min-w-[24px]" />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 lg:opacity-0 transition-opacity">Dashboard</span>
          </a>
          <a href="#" className="flex items-center space-x-3 p-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Settings size={24} className="min-w-[24px]" />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 lg:opacity-0 transition-opacity">Settings</span>
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header - Reverted to standard white background */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 z-40">
          <div className="flex items-center">
            <button onClick={toggleSidebar} className="mr-4 lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full">
              <MenuIcon size={24} />
            </button>
            <h1 className="text-xl font-semibold text-slate-800 hidden sm:block">Principal Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-slate-900">Guðrún Jónsdóttir</p>
              <p className="text-xs text-slate-500">Skólastjóri (Principal)</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
              GJ
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* SECTION 1: School Information & Actions */}
            <section className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{schoolData.name}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm mt-1">
                    <span className="flex items-center gap-1"><MapPin size={14}/> {schoolData.address}</span>
                    <span className="hidden md:inline text-slate-300">|</span>
                    <span>Kt: {schoolData.kennitala}</span>
                    <span className="hidden md:inline text-slate-300">|</span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{schoolData.type}</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors shadow-sm"
                  >
                    <Edit3 size={16} />
                    {isEditing ? 'Save Values' : 'Edit Values'}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors shadow-sm">
                    <Settings size={16} />
                    Settings
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm">
                    <Download size={16} />
                    Stats Report
                  </button>
                </div>
              </div>

              {/* Data Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Students / Enrollment (Hero Card) */}
                <Card className="col-span-1 md:col-span-2 p-6 flex flex-col justify-center">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-blue-100 rounded-md text-blue-600">
                          <Baby size={18} />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Students Enrolled</p>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <h3 className="text-3xl font-bold text-slate-900">{schoolData.enrolledCount}</h3>
                        <span className="text-slate-400 font-medium">/ {schoolData.maxCapacity} capacity</span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${capacityPercentage > 95 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {capacityPercentage}% Full
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-3 mt-3 overflow-hidden">
                    <div 
                      className={`h-3 rounded-full ${capacityPercentage > 95 ? 'bg-red-500' : 'bg-blue-500'}`} 
                      style={{ width: `${capacityPercentage}%` }}
                    ></div>
                  </div>
                </Card>

                {/* 2. Spatial Stats */}
                <StatBadge 
                  label="Floor Area" 
                  value={`${schoolData.totalFloorArea} m²`} 
                  subtext={`Play area: ${schoolData.playArea} m²`}
                  icon={Maximize2}
                  colorClass="bg-purple-100 text-purple-600"
                />

                <StatBadge 
                  label="Space per Child" 
                  value={`${sqMetersPerChild} m²`} 
                  subtext="Based on current enrollment"
                  icon={Minimize2}
                  colorClass="bg-teal-100 text-teal-600"
                />

                {/* 3. People & Media Metric Cards */}
                
                <StatBadge 
                  label="Guardians" 
                  value={schoolData.guardiansCount} 
                  subtext="Registered parents"
                  icon={UsersRound}
                  colorClass="bg-orange-100 text-orange-600"
                />

                <StatBadge 
                  label="Teachers" 
                  value={schoolData.teachersCount} 
                  subtext="Active staff members"
                  icon={GraduationCap}
                  colorClass="bg-indigo-100 text-indigo-600"
                />

                <StatBadge 
                  label="Classes" 
                  value={schoolData.classesCount} 
                  subtext="Active groups"
                  icon={Layers}
                  colorClass="bg-pink-100 text-pink-600"
                />

                <StatBadge 
                  label="Media Items" 
                  value={schoolData.mediaCount.toLocaleString()} 
                  subtext="Photos & Videos"
                  icon={ImageIcon}
                  colorClass="bg-cyan-100 text-cyan-600"
                />

              </div>
            </section>

            <hr className="border-slate-200" />

            {/* SECTION 2: Navigation Tiles */}
            <section>
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <LayoutDashboard size={20} className="text-slate-400" />
                Management Modules
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                
                {/* People & Organization */}
                <NavTile 
                  title="Departments" 
                  subTitle="Rooms & Units" 
                  icon={Building2} 
                  color="bg-indigo-600" 
                  onClick={() => console.log("Nav to Depts")}
                />
                <NavTile 
                  title="Students" 
                  subTitle="Enrollment" 
                  icon={Users} 
                  color="bg-blue-600" 
                  onClick={() => console.log("Nav to Students")}
                />
                <NavTile 
                  title="Staff" 
                  subTitle="Teachers" 
                  icon={Users} 
                  color="bg-cyan-600" 
                  onClick={() => console.log("Nav to Staff")}
                />

                {/* Daily Operations */}
                <NavTile 
                  title="Menu" 
                  subTitle="Dietary" 
                  icon={Utensils} 
                  color="bg-orange-500" 
                  onClick={() => console.log("Nav to Menu")}
                />
                <NavTile 
                  title="Calendar" 
                  subTitle="Events" 
                  icon={Calendar} 
                  color="bg-emerald-500" 
                  onClick={() => console.log("Nav to Calendar")}
                />

                {/* Content & Media */}
                <NavTile 
                  title="Media" 
                  subTitle="Gallery" 
                  icon={ImageIcon} 
                  color="bg-pink-500" 
                  onClick={() => console.log("Nav to Media")}
                />
                <NavTile 
                  title="Files" 
                  subTitle="Documents" 
                  icon={FileText} 
                  color="bg-slate-500" 
                  onClick={() => console.log("Nav to Files")}
                />

                {/* Safety & Logs */}
                <NavTile 
                  title="Accidents" 
                  subTitle="Slysaskráning" 
                  icon={AlertTriangle} 
                  color="bg-red-500" 
                  onClick={() => console.log("Nav to Accidents")}
                />
                <NavTile 
                  title="Incidents" 
                  subTitle="Atvikaskráning" 
                  icon={AlertOctagon} 
                  color="bg-amber-500" 
                  onClick={() => console.log("Nav to Incidents")}
                />

                {/* Admin & Analysis */}
                <NavTile 
                  title="Statistics" 
                  subTitle="Reports" 
                  icon={BarChart3} 
                  color="bg-violet-600" 
                  onClick={() => console.log("Nav to Stats")}
                />
                <NavTile 
                  title="Tilraunalisti" 
                  subTitle="Experimental" 
                  icon={FlaskConical} 
                  color="bg-lime-600" 
                  onClick={() => console.log("Nav to Experimental")}
                />

              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}