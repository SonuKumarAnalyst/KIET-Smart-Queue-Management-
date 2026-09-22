import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, CheckCircle, Users, Shield, Clock } from "lucide-react";

export default function Home() {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

  const fullText = "KIET Smart Queue Management";
  const [displayText, setDisplayText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < fullText.length) {
      const t = setTimeout(() => {
        setDisplayText((p) => p + fullText[index]);
        setIndex(index + 1);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [index]);

  const roles = [
    {
      name: "Student",
      path: "/student",
      label: "S",
      desc: "Join active queues from anywhere on campus. Track your live position, receive instant notifications, and save valuable time for what matters most.",
      icon: Users,
      color: "blue",
    },
    {
      name: "Staff",
      path: "/staff",
      label: "T",
      desc: "Manage departmental flow with precision. Call tickets, handle emergency requests, and monitor real-time analytics to ensure efficient service delivery.",
      icon: Clock,
      color: "emerald",
    },
    {
      name: "Admin",
      path: "/admin",
      label: "A",
      desc: "Oversee the entire campus ecosystem. Configure departments, manage staff access, and view comprehensive reports to optimize university operations.",
      icon: Shield,
      color: "violet",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative">
      
      {/* GLOBAL BACKGROUND ELEMENTS (Replaced by NetworkBackground) */}
      <div className="fixed inset-0 pointer-events-none -z-20">
      </div>

      {/* HERO SECTION WITH PARALLAX */}
      <motion.section 
        ref={targetRef}
        style={{ opacity, scale, y }}
        className="relative min-h-screen flex flex-col justify-center items-center text-center px-6 pt-20 pb-32"
      >
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg"
        >
          
          
        </motion.div>

        <h1 className="text-5xl md:text-8xl font-black leading-tight tracking-tighter mb-8 bg-gradient-to-r from-[var(--text-primary)] via-[var(--accent-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent bg-[size:200%_auto] animate-gradient-text">
          {displayText}
          <span className="text-[var(--accent-primary)] animate-pulse">|</span>
        </h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="text-lg md:text-2xl text-[var(--text-secondary)] max-w-3xl mx-auto mb-12 leading-relaxed font-light"
        >
          Eliminate physical lines. <span className="text-[var(--text-primary)] font-medium">Streamline services.</span> <br className="hidden md:block"/>
          Real-time tracking for a smarter campus.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-5 w-full justify-center"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/login"
              className="group relative px-10 py-5 rounded-2xl font-bold text-white bg-[var(--accent-primary)] overflow-hidden shadow-[0_0_50px_rgba(0,212,170,0.3)] block"
            >
              <span className="relative z-10 flex items-center gap-3">
                Get Started <ArrowRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/about"
              className="px-10 py-5 rounded-2xl font-bold text-[var(--text-primary)] bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[var(--accent-primary)] transition-all backdrop-blur-md block shadow-xl"
            >
              Learn More
            </Link>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ROLES CARDS (Animated) */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {roles.map((role, i) => (
              <motion.div
                key={role.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.5 }}
                whileHover={{ y: -12, transition: { duration: 0.2 } }}
                className="group relative p-8 rounded-3xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--accent-primary)] transition-all duration-300 shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
              >
                <div className={`w-14 h-14 rounded-2xl mb-6 flex items-center justify-center bg-${role.color}-500/10 text-${role.color}-500 group-hover:bg-${role.color}-500 group-hover:text-white transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(var(--accent-primary),0.3)]`}>
                  <role.icon size={28} />
                </div>
                
                <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3 group-hover:translate-x-1 transition-transform">
                  {role.name}
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed mb-8 group-hover:text-[var(--text-primary)] transition-colors">
                  {role.desc}
                </p>

                <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                  <ArrowRight className={`text-${role.color}-500`} />
                </div>
                
                {/* Subtle Hover Glow */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[var(--accent-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* KEY FEATURES BENTO GRID */}
      <section className="py-20 px-6 relative z-10">
         <div className="max-w-7xl mx-auto">
             <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">Why Choose Us?</h2>
                <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">Experience the future of campus management with our cutting-edge features.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
                 {/* Feature 1: Large Span */}
                 <motion.div 
                   initial={{opacity: 0, y: 20}} whileInView={{opacity: 1, y: 0}} viewport={{once: true}}
                   whileHover={{ y: -5, transition: { duration: 0.2 } }}
                   className="md:col-span-2 relative overflow-hidden rounded-3xl p-8 bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent-primary)] transition-all group shadow-xl"
                 >
                    <div className="relative z-10 h-full flex flex-col justify-between">
                       <div>
                          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all">
                             <Clock size={24} />
                          </div>
                          <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2 group-hover:translate-x-1 transition-transform">Real-time Predictions</h3>
                          <p className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Our advanced algorithms analyze historical data to provide accurate wait time estimates, so you never waste a minute.</p>
                       </div>
                       <div className="translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                          <span className="text-blue-500 font-bold flex items-center gap-2">Learn how <ArrowRight size={16}/></span>
                       </div>
                    </div>
                    {/* Abstract Grid BG */}
                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(59,130,246,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.2)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)]" />
                 </motion.div>

                 {/* Feature 2: Tall */}
                 <motion.div 
                   initial={{opacity: 0, y: 20}} whileInView={{opacity: 1, y: 0}} viewport={{once: true}} transition={{delay: 0.1}}
                   whileHover={{ y: -5, transition: { duration: 0.2 } }}
                   className="md:row-span-2 relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-2xl flex flex-col justify-between group"
                 >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                       <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                          <CheckCircle size={24} />
                       </div>
                       <h3 className="text-3xl font-bold mb-4 group-hover:translate-x-1 transition-transform">Instant Notifications</h3>
                       <p className="text-white/80 leading-relaxed mb-6">Never miss your turn. Get instant push notifications and SMS alerts when your ticket is called.</p>
                    </div>
                    
                    <div className="relative h-44 bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/10 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-2xl">
                       <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-green-400 border-4 border-white/20" />
                          <div className="h-2.5 w-24 bg-white/50 rounded-full" />
                       </div>
                       <div className="h-2.5 w-full bg-white/20 rounded-full mb-3" />
                       <div className="h-2.5 w-3/4 bg-white/20 rounded-full" />
                    </div>
                 </motion.div>

                 {/* Feature 3 */}
                 <motion.div 
                   initial={{opacity: 0, y: 20}} whileInView={{opacity: 1, y: 0}} viewport={{once: true}} transition={{delay: 0.2}}
                   whileHover={{ y: -5, scale: 1.02 }}
                   className="relative overflow-hidden rounded-3xl p-8 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-purple-500/50 transition-all duration-300 shadow-xl group"
                 >
                    <Shield size={40} className="text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Enterprise Security</h3>
                    <p className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Bank-grade encryption and role-based access control to keep your data safe.</p>
                 </motion.div>

                 {/* Feature 4 */}
                 <motion.div 
                   initial={{opacity: 0, y: 20}} whileInView={{opacity: 1, y: 0}} viewport={{once: true}} transition={{delay: 0.3}}
                   whileHover={{ y: -5, scale: 1.02 }}
                   className="relative overflow-hidden rounded-3xl p-8 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-pink-500/50 transition-all duration-300 shadow-xl group"
                 >
                    <Users size={40} className="text-pink-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Live Analytics</h3>
                    <p className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Monitor crowd density and service metrics in real-time.</p>
                 </motion.div>
             </div>
         </div>
      </section>

      {/* MERGED ABOUT SECTION */}
      <section className="py-32 px-6 bg-transparent relative overflow-hidden">
        {/* Decorative BG */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
               <h2 className="text-4xl md:text-6xl font-bold text-[var(--text-primary)] mb-8 leading-tight">
                 Wait Less. <br />
                 <span className="text-[var(--accent-secondary)]">Do More.</span>
               </h2>
               <div className="space-y-6 text-lg text-[var(--text-secondary)]">
                 <p className="flex items-start gap-4">
                   <CheckCircle className="text-[var(--accent-primary)] mt-1 shrink-0" />
                   <span>Replaces physical lines with a centralized digital dashboard.</span>
                 </p>
                 <p className="flex items-start gap-4">
                   <CheckCircle className="text-[var(--accent-primary)] mt-1 shrink-0" />
                   <span>Role-based access ensures security and efficiency.</span>
                 </p>
                 <p className="flex items-start gap-4">
                   <CheckCircle className="text-[var(--accent-primary)] mt-1 shrink-0" />
                   <span>Real-time notifications so you only show up when it's your turn.</span>
                 </p>
               </div>

               <div className="mt-12 flex gap-8">
                 <div className="text-center">
                    <h4 className="text-4xl font-bold text-[var(--text-primary)]">5k+</h4>
                    <p className="text-sm text-[var(--text-secondary)] uppercase tracking-wider mt-1">Users</p>
                 </div>
                 <div className="hidden w-px bg-[var(--glass-border)] md:block" />
                 <div className="text-center">
                    <h4 className="text-4xl font-bold text-[var(--text-primary)]">45%</h4>
                    <p className="text-sm text-[var(--text-secondary)] uppercase tracking-wider mt-1">Faster</p>
                 </div>
               </div>
            </motion.div>

            <motion.div
               initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
               whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.8 }}
               className="relative"
            >
               {/* Abstract Visual Representation */}
               <div className="relative z-10 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
                 <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)] text-xl">Live Queue Status</h4>
                      <p className="text-sm text-[var(--text-secondary)]">Registrar Office</p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-bold animate-pulse">
                      ACTIVE
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)] font-bold">
                          {i}
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-24 bg-white/20 rounded mb-2" />
                          <div className="h-2 w-16 bg-white/10 rounded" />
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">2m ago</div>
                      </div>
                    ))}
                 </div>

                 <div className="mt-8 pt-6 border-t border-[var(--glass-border)] text-center">
                    <p className="text-sm text-[var(--text-secondary)]">Average Wait Time</p>
                    <h3 className="text-3xl font-bold text-[var(--text-primary)] mt-1">12 mins</h3>
                 </div>
               </div>

               {/* Decorative Elements behind card */}
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-[var(--accent-secondary)] rounded-full blur-[80px] opacity-40 z-0" />
               <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[var(--accent-primary)] rounded-full blur-[80px] opacity-40 z-0" />
            </motion.div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 text-center">
         <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-6">Ready to get started?</h2>
         <Link to="/signup" className="text-[var(--accent-primary)] text-xl font-bold hover:underline underline-offset-4 decoration-2">
            Create your account now &rarr;
         </Link>
      </section>

    </div>
  );
}




