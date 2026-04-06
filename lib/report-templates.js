export const reportTemplateDefinitions = [
    {
        id: "default-progress",
        name: "Standard Progress Summary",
        description: "A concise narrative summary with accomplishments, risks, focus areas, next steps, and evidence highlights.",
        promptGuidance: "Use a concise professional progress-summary format with an overview, accomplishments, current focus, risks, next steps, and source highlights."
    },
    {
        id: "collato-monthly-report",
        name: "Collato Monthly Report",
        description: "A structured monthly report with report header fields, status summary, project overview table, other information, and general instructions.",
        promptGuidance: `Use a monthly report structure modeled on this format:
- Report title: MONTHLY REPORT and project name
- Header fields: report date, prepared by, report number, month of
- Contact area: query contacts and project associate
- Status Summary of the month: concise bullets describing current project status, work carried out in the previous month, stage/progress, important issues, and urgent items
- Project Overview For The Month: a dated list/table of key activities, workshops, site visits, submissions, meetings, progress events, or milestone items
- Other Info: a dated list/table of extra notes, modeling/report sharing, upcoming meetings/visits, ideas, important reminders, or operational notes
- General Instructions: a short list of recurring project instructions or process reminders when relevant
Return content in a polished client-ready style without placeholder text. If some header fields are unknown, infer only when supported by context or clarification answers; otherwise leave them short and neutral rather than inventing details.`
    }
];
export function getReportTemplateDefinition(templateId) {
    return reportTemplateDefinitions.find((template) => template.id === templateId) ?? reportTemplateDefinitions[0];
}


