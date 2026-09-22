import { useEffect, useState } from "react";
import { CheckCircle, ChevronDown, ExternalLink, HelpCircle, Search } from "lucide-react";
import toast from "react-hot-toast";
import { createSupportRequest, getMySupportRequests } from "../../services/support";
import { socket } from "../../services/socket";

const HELP_TOPICS = [
  {
    id: "term-registration",
    title: "Term registration",
    category: "Academic",
    summary: "Resolve common registration holds before visiting the Registrar.",
    steps: [
      "Open the student ERP and check Registration or Holds.",
      "Clear any pending fee, document, or approval hold shown there.",
      "Select your current term, verify your subjects, and submit registration.",
      "Save the confirmation page or registration number for your records.",
    ],
    checklist: ["Student ID", "Fee clearance", "Previous term result"],
    department: "Registrar",
  },
  {
    id: "college-email",
    title: "College email ID",
    category: "Accounts",
    summary: "Troubleshoot activation, password, and login problems for your college email.",
    steps: [
      "Check your registered personal email and spam folder for the activation message.",
      "Use the college email password-reset option if you cannot sign in.",
      "Try an incognito window and confirm that your student ID is entered correctly.",
      "If the account is still inactive, submit a support request with a screenshot.",
    ],
    checklist: ["Student ID", "Registered phone number", "Error screenshot"],
    department: "IT Helpdesk",
  },
  {
    id: "erp-login",
    title: "ERP login issue",
    category: "ERP",
    summary: "Fix incorrect password, locked account, and blank dashboard problems.",
    steps: [
      "Confirm that Caps Lock is off and enter your student ID without spaces.",
      "Reset your password using the Forgot Password option.",
      "Clear the browser cache or try Chrome in a private window.",
      "Wait 15 minutes if the account is temporarily locked, then try again.",
    ],
    checklist: ["Student ID", "Registered email", "Screenshot of the error"],
    department: "IT Helpdesk",
  },
  {
    id: "documents",
    title: "Certificates and documents",
    category: "Student Services",
    summary: "Check whether a document can be requested online before visiting an office.",
    steps: [
      "Open the ERP student services or certificates section.",
      "Choose the required document and verify your delivery address.",
      "Upload only the documents requested by the form.",
      "Save the request number so you can track its progress.",
    ],
    checklist: ["Student ID", "Application details", "Required supporting document"],
    department: "Registrar",
  },
];

export default function StudentHelpdesk({ departments, onJoinDepartment }) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(HELP_TOPICS[0].id);
  const [resolved, setResolved] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ departmentId: "", category: "other", subject: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMySupportRequests().then(setRequests).catch(() => {});

    const handleSupportUpdate = async () => {
      setRequests(await getMySupportRequests());
      toast.success("Your department replied to a support request.");
    };

    socket.on("support_request_updated", handleSupportUpdate);
    return () => socket.off("support_request_updated", handleSupportUpdate);
  }, []);

  const updateRequestField = (event) => {
    setRequestForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmitRequest = async (event) => {
    event.preventDefault();
    if (!requestForm.departmentId || !requestForm.subject.trim() || !requestForm.description.trim()) return;

    try {
      setSubmitting(true);
      await createSupportRequest(requestForm);
      setRequests(await getMySupportRequests());
      setRequestForm({ departmentId: "", category: "other", subject: "", description: "" });
      setShowRequestForm(false);
      toast.success("Your problem was sent to the department.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send your request");
    } finally {
      setSubmitting(false);
    }
  };

  const openRequestFor = (departmentName = "") => {
    const department = departments.find((item) => item.name.toLowerCase().includes(departmentName.toLowerCase()));
    setRequestForm((current) => ({ ...current, departmentId: department?._id || "" }));
    setShowRequestForm(true);
  };

  const statusStyles = {
    open: "text-blue-300 bg-blue-500/10",
    "in-progress": "text-amber-300 bg-amber-500/10",
    resolved: "text-emerald-300 bg-emerald-500/10",
    "visit-required": "text-red-300 bg-red-500/10",
    closed: "text-slate-300 bg-white/10",
  };

  const visibleTopics = HELP_TOPICS.filter((topic) => {
    const text = `${topic.title} ${topic.category} ${topic.summary}`.toLowerCase();
    return text.includes(query.toLowerCase().trim());
  });

  const markResolved = (id) => {
    setResolved((current) => current.includes(id) ? current : [...current, id]);
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="nebula-card p-8 md:p-10 border-cyan-500/20 bg-cyan-500/5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400"><HelpCircle size={24} /></div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-400">Student Self-Service</p>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Solve it before you visit</h2>
            <p className="text-slate-400 mt-2 max-w-2xl">Find a quick solution or send your problem directly to the concerned department. Staff can solve it remotely or tell you when an in-person visit is required.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a student problem..." className="input-field w-full pl-11" />
          </div>
          <button onClick={() => openRequestFor()} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 transition-colors">Report a problem</button>
        </div>
      </div>

      {showRequestForm && (
        <form onSubmit={handleSubmitRequest} className="nebula-card p-6 md:p-8 border-cyan-500/30 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white">Send a problem to staff</h3>
              <p className="text-sm text-slate-400 mt-1">Include enough detail so the department can help without asking you to visit.</p>
            </div>
            <button type="button" onClick={() => setShowRequestForm(false)} className="text-slate-400 hover:text-white">Cancel</button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <select name="departmentId" value={requestForm.departmentId} onChange={updateRequestField} required className="input-field">
              <option value="">Select concerned department</option>
              {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
            </select>
            <select name="category" value={requestForm.category} onChange={updateRequestField} className="input-field">
              <option value="other">Other problem</option>
              <option value="term-registration">Term registration</option>
              <option value="college-email">College email</option>
              <option value="erp">ERP</option>
              <option value="documents">Documents</option>
            </select>
          </div>
          <input name="subject" value={requestForm.subject} onChange={updateRequestField} maxLength={120} required placeholder="Short subject, e.g. Term registration is blocked" className="input-field w-full" />
          <textarea name="description" value={requestForm.description} onChange={updateRequestField} maxLength={2000} required rows={5} placeholder="Explain what happened, what you tried, and any error message..." className="input-field w-full resize-none" />
          <div className="flex justify-end"><button disabled={submitting} className="rounded-xl bg-cyan-500 px-6 py-3 font-black text-slate-950 disabled:opacity-50">{submitting ? "Sending..." : "Send to department"}</button></div>
        </form>
      )}

      {requests.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">My support requests</h3>
          {requests.map((request) => (
            <div key={request._id} className="nebula-card p-5 border-white/10">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div><h4 className="font-black text-white">{request.subject}</h4><p className="text-xs text-slate-500 mt-1">{request.department?.name} · {new Date(request.createdAt).toLocaleString()}</p></div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyles[request.status] || statusStyles.open}`}>{request.status.replace("-", " ")}</span>
              </div>
              <p className="text-sm text-slate-300 mt-4">{request.description}</p>
              {request.staffResponse && <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-100"><strong>Department response:</strong> {request.staffResponse}</div>}
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-4">
        {visibleTopics.map((topic) => {
          const isExpanded = expandedId === topic.id;
          return (
            <div key={topic.id} className="nebula-card overflow-hidden border-white/10">
              <button onClick={() => setExpandedId(isExpanded ? "" : topic.id)} className="w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-lg font-black text-white">{topic.title}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full">{topic.category}</span>
                  </div>
                  <p className="text-sm text-slate-400">{topic.summary}</p>
                </div>
                <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-white/10 p-6 grid lg:grid-cols-[1fr_260px] gap-8">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Try these steps</p>
                    <ol className="space-y-4">
                      {topic.steps.map((step, index) => (
                        <li key={step} className="flex gap-3 text-sm text-slate-300">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-black text-cyan-400">{index + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    <button onClick={() => markResolved(topic.id)} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300">
                      <CheckCircle size={17} /> {resolved.includes(topic.id) ? "Marked as resolved" : "This solved my problem"}
                    </button>
                  </div>
                  <aside className="rounded-2xl border border-white/10 bg-white/5 p-5 h-fit">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Keep ready</p>
                    <ul className="space-y-2 mb-5">
                      {topic.checklist.map((item) => <li key={item} className="text-sm text-slate-300">• {item}</li>)}
                    </ul>
                    <div className="space-y-2">
                      <button onClick={() => openRequestFor(topic.department)} className="w-full rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20 transition-colors">Send problem to {topic.department}</button>
                      <button onClick={() => onJoinDepartment(topic.department)} className="w-full text-xs font-bold text-slate-400 hover:text-white">Need to visit? Join queue <ExternalLink size={13} className="inline ml-1" /></button>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          );
        })}
        {visibleTopics.length === 0 && <div className="nebula-card p-10 text-center text-slate-400">No matching help article found. Try “ERP”, “email”, or “registration”.</div>}
      </div>
    </div>
  );
}
