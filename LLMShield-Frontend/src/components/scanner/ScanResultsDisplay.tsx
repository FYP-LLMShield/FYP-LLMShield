import React from 'react';
import { ScanResponse, Finding } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import { AlertTriangle, FileText, CheckCircle2, Shield, Bug, Zap, Info, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface ScanResultsDisplayProps {
  scanResults: ScanResponse;
  onDownloadPDF: () => void;
  vulnerabilities?: any[];
  inputMethod?: string;
}

export const ScanResultsDisplay: React.FC<ScanResultsDisplayProps> = ({ scanResults, onDownloadPDF }) => {
  // Helper functions for rendering
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-[#e74c3c] text-white";
      case "High":
        return "bg-[#e67e22] text-white";
      case "Medium":
        return "bg-[#f39c12] text-black";
      case "Low":
        return "bg-[#3498db] text-white";
      case "Info":
        return "bg-[#95a5a6] text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "Critical":
        return <AlertTriangle className="w-4 h-4" />;
      case "High":
        return <Shield className="w-4 h-4" />;
      case "Medium":
        return <Bug className="w-4 h-4" />;
      case "Low":
        return <Zap className="w-4 h-4" />;
      case "Info":
        return <Info className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "CRITICAL":
        return "bg-[#e74c3c] text-white";
      case "HIGH":
        return "bg-[#e67e22] text-white";
      case "MEDIUM":
        return "bg-[#f39c12] text-black";
      case "LOW":
        return "bg-[#3498db] text-white";
      case "SAFE":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "Very High":
        return "bg-green-500 text-white";
      case "High":
        return "bg-blue-500 text-white";
      case "Medium":
        return "bg-yellow-500 text-black";
      case "Low":
        return "bg-orange-500 text-white";
      case "Uncertain":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getPriorityBadge = (priority: number) => {
    const colors = [
      "bg-red-600 text-white", // Priority 1
      "bg-orange-500 text-white", // Priority 2
      "bg-yellow-500 text-black", // Priority 3
      "bg-blue-500 text-white", // Priority 4
      "bg-gray-500 text-white", // Priority 5
    ];
    
    return (
      <Badge className={`${priority <= 5 ? colors[priority - 1] : colors[4]}`}>
        P{priority}
      </Badge>
    );
  };
  
  // Helper function to provide descriptions for common risk types
  const getRiskDescription = (riskType: string): string => {
    const descriptions: Record<string, string> = {
      "memory": "Memory-related vulnerabilities that can lead to buffer overflows, use-after-free, or memory leaks, potentially allowing code execution or system crashes.",
      "printf": "Format string vulnerabilities that occur when user input is used as the format string in printf-like functions, potentially leading to information disclosure or code execution.",
      "fprintf": "File output format string vulnerabilities that can lead to information disclosure or code execution when handling untrusted input.",
      "sql": "SQL injection vulnerabilities that allow attackers to execute arbitrary SQL commands, potentially leading to data theft, modification, or destruction.",
      "xss": "Cross-site scripting vulnerabilities that allow attackers to inject malicious scripts into web pages viewed by other users.",
      "csrf": "Cross-site request forgery vulnerabilities that force users to execute unwanted actions on websites they're authenticated to.",
      "path": "Path traversal vulnerabilities that allow attackers to access files and directories outside of intended boundaries.",
      "command": "Command injection vulnerabilities that allow execution of arbitrary system commands through unsanitized user input.",
      "authentication": "Authentication weaknesses that could allow unauthorized access to protected resources or functionality.",
      "authorization": "Authorization flaws that could allow users to access resources or perform actions they shouldn't be permitted to.",
      "crypto": "Cryptographic weaknesses including weak algorithms, improper key management, or insecure implementations.",
      "input": "Input validation vulnerabilities where user-supplied data is not properly sanitized before use."
    };
    
    // Try to find an exact match first
    if (descriptions[riskType]) {
      return descriptions[riskType];
    }
    
    // If no exact match, try to find a partial match
    for (const [key, description] of Object.entries(descriptions)) {
      if (riskType.includes(key)) {
        return description;
      }
    }
    
    // Default description if no match found
    return "A security vulnerability that may impact the confidentiality, integrity, or availability of the system.";
  };

  // Process critical findings to ensure filenames are available for most affected files
  React.useEffect(() => {
    if (scanResults.most_affected_files && scanResults.most_affected_files.length > 0) {
      // Create maps to store all filenames and their relationships
      const fileMap = new Map(); // Maps line numbers to filenames
      const filesByLineCount = new Map(); // Tracks frequency of each filename
      const lineToFileMap = new Map(); // Maps line numbers to filenames more directly
      
      // First, collect all filenames from critical findings (highest priority)
      if (scanResults.critical_findings && scanResults.critical_findings.length > 0) {
        scanResults.critical_findings.forEach(finding => {
          if (finding.file && finding.line) {
            fileMap.set(finding.line.toString(), finding.file);
            lineToFileMap.set(finding.line, finding.file);
            
            // Track files by their occurrence count
            const count = filesByLineCount.get(finding.file) || 0;
            filesByLineCount.set(finding.file, count + 1);
          }
        });
      }
      
      // Also collect filenames from all findings to have more matches
      if (scanResults.findings && scanResults.findings.length > 0) {
        scanResults.findings.forEach(finding => {
          if (finding.file && finding.line) {
            fileMap.set(finding.line.toString(), finding.file);
            lineToFileMap.set(finding.line, finding.file);
            
            // Track files by their occurrence count
            const count = filesByLineCount.get(finding.file) || 0;
            filesByLineCount.set(finding.file, count + 1);
          }
        });
      }
      
      // Get the most common filenames for fallback, sorted by frequency
      const sortedFiles = Array.from(filesByLineCount.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      // Create a direct mapping of affected files by matching line numbers
      const updatedFiles = scanResults.most_affected_files.map(file => {
        // Check if the file has a filename property (from backend)
        if (file.filename && file.filename !== "Unknown") {
          return { ...file, file_path: file.filename };
        }
        
        // If file already has a valid path, keep it
        if (file.file_path && file.file_path !== "Unknown") {
          return file;
        }
        
        // Try to find a matching filename using the affected lines
        if (file.lines_affected && file.lines_affected.length > 0) {
          // Create a frequency map of filenames for this file's affected lines
          const fileFrequency = new Map();
          
          for (const line of file.lines_affected) {
            const filename = lineToFileMap.get(line);
            if (filename) {
              const count = fileFrequency.get(filename) || 0;
              fileFrequency.set(filename, count + 1);
            }
          }
          
          // If we found any filenames, use the most frequent one
          if (fileFrequency.size > 0) {
            const mostFrequentFile = Array.from(fileFrequency.entries())
              .sort((a, b) => b[1] - a[1])[0][0];
            return { ...file, file_path: mostFrequentFile };
          }
          
          // If that didn't work, try the old approach of matching individual lines
          for (const line of file.lines_affected) {
            const filename = fileMap.get(line.toString());
            if (filename) {
              return { ...file, file_path: filename };
            }
          }
        }
        
        // If no match found but we have files from findings, use the most common one as fallback
        if (sortedFiles.length > 0) {
          return { ...file, file_path: sortedFiles[0] };
        }
        
        // If we have critical findings but no match was found, use the first critical finding's file
        if (scanResults.critical_findings && scanResults.critical_findings.length > 0 && scanResults.critical_findings[0].file) {
          return { ...file, file_path: scanResults.critical_findings[0].file };
        }
        
        // Last resort - if we have any findings at all, use the first one's filename
        if (scanResults.findings && scanResults.findings.length > 0 && scanResults.findings[0].file) {
          return { ...file, file_path: scanResults.findings[0].file };
        }
        
        return file;
      });
      
      // Update the scanResults object with the new most_affected_files
      scanResults.most_affected_files = updatedFiles;
    }
  }, [scanResults]);

  return (
    <div className="space-y-6">
      {/* Executive Summary Card */}
      <Card className="border-t-4" style={{ borderTopColor: scanResults.executive_summary.risk_level === "SAFE" ? "#4ade80" : "#e74c3c" }}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Badge className={`text-lg px-3 py-1 ${getRiskLevelColor(scanResults.executive_summary.risk_level)}`}>
                  <span className="mr-2">{scanResults.executive_summary.risk_emoji}</span>
                  {scanResults.executive_summary.risk_level} RISK
                </Badge>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="text-3xl font-bold">{scanResults.findings.length}</div>
                  <div className="text-sm text-gray-500">Total Issues</div>
                </div>
                <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="text-3xl font-bold">{scanResults.severity_distribution.critical}</div>
                  <div className="text-sm text-gray-500">Critical Issues</div>
                </div>
                <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="text-3xl font-bold">
                    {new Set(scanResults.findings.map(f => f.file)).size}
                  </div>
                  <div className="text-sm text-gray-500">Files Affected</div>
                </div>
              </div>
              
              <h3 className="font-semibold mb-2">Top Security Vulnerabilities:</h3>
              <ul className="list-none pl-2 space-y-2">
                {scanResults.executive_summary.top_risks.map((risk, index) => {
                  // Extract the risk name and points from the format "memory (132 risk points)"
                  const match = risk.match(/^([a-zA-Z\s-]+)\s*\((\d+)\s*risk\s*points\)$/i);
                  if (match) {
                    const [_, riskName, riskPoints] = match;
                    const riskDescription = getRiskDescription(riskName.trim().toLowerCase());
                    return (
                      <li key={index} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md border-l-4 border-red-500">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-red-600 dark:text-red-400">{riskName.trim()}</span>
                          <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-white px-2 py-1 rounded-md text-sm">
                            {riskPoints} Risk Points
                          </span>
                        </div>
                        {riskDescription && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{riskDescription}</p>}
                      </li>
                    );
                  }
                  return <li key={index} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">{risk}</li>;
                })}
              </ul>
            </div>
            
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-inner">
              <h3 className="font-semibold mb-4 text-center">Severity Distribution</h3>
              <div className="space-y-4">
                {/* Critical */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-[#e74c3c] mr-2" />
                      <span className="font-semibold text-[#e74c3c]">Critical</span>
                    </div>
                    <div className="bg-[#e74c3c] text-white px-2 py-0.5 rounded-full text-xs font-bold">
                      {scanResults.severity_distribution.critical}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#e74c3c] to-[#c0392b] h-full rounded-full shadow-inner transition-all duration-500 ease-in-out" 
                      style={{ width: `${Math.max(5, scanResults.severity_distribution.critical * 100 / scanResults.findings.length)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* High */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 text-[#e67e22] mr-2" />
                      <span className="font-semibold text-[#e67e22]">High</span>
                    </div>
                    <div className="bg-[#e67e22] text-white px-2 py-0.5 rounded-full text-xs font-bold">
                      {scanResults.severity_distribution.high}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#e67e22] to-[#d35400] h-full rounded-full shadow-inner transition-all duration-500 ease-in-out" 
                      style={{ width: `${Math.max(5, scanResults.severity_distribution.high * 100 / scanResults.findings.length)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Medium */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Bug className="h-4 w-4 text-[#f39c12] mr-2" />
                      <span className="font-semibold text-[#f39c12]">Medium</span>
                    </div>
                    <div className="bg-[#f39c12] text-black px-2 py-0.5 rounded-full text-xs font-bold">
                      {scanResults.severity_distribution.medium}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#f39c12] to-[#e67e22] h-full rounded-full shadow-inner transition-all duration-500 ease-in-out" 
                      style={{ width: `${Math.max(5, scanResults.severity_distribution.medium * 100 / scanResults.findings.length)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Low */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Zap className="h-4 w-4 text-[#3498db] mr-2" />
                      <span className="font-semibold text-[#3498db]">Low</span>
                    </div>
                    <div className="bg-[#3498db] text-white px-2 py-0.5 rounded-full text-xs font-bold">
                      {scanResults.severity_distribution.low}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#3498db] to-[#2980b9] h-full rounded-full shadow-inner transition-all duration-500 ease-in-out" 
                      style={{ width: `${Math.max(5, scanResults.severity_distribution.low * 100 / scanResults.findings.length)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Info */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Info className="h-4 w-4 text-[#95a5a6] mr-2" />
                      <span className="font-semibold text-[#95a5a6]">Info</span>
                    </div>
                    <div className="bg-[#95a5a6] text-white px-2 py-0.5 rounded-full text-xs font-bold">
                      {scanResults.severity_distribution.info}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#95a5a6] to-[#7f8c8d] h-full rounded-full shadow-inner transition-all duration-500 ease-in-out" 
                      style={{ width: `${Math.max(5, scanResults.severity_distribution.info * 100 / scanResults.findings.length)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Total Issues Summary */}
                <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">Total Issues:</span>
                    <span className="font-bold text-lg">{scanResults.findings.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Findings Section */}
      {scanResults.critical_findings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#e74c3c]" />
              Critical Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scanResults.critical_findings.map((finding) => (
                <div key={finding.id} className="p-4 border-2 border-red-500 bg-white dark:bg-gray-800 dark:text-white rounded-lg shadow-md">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{finding.severity_emoji}</span>
                      <span className="font-bold text-red-600 dark:text-red-400">{finding.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(finding.priority_rank)}
                      <Badge className={getSeverityColor(finding.severity)}>
                        {getSeverityIcon(finding.severity)}
                        <span className="ml-1">{finding.severity}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 text-black dark:text-white">
                    <div className="font-medium">File: <span className="text-gray-700 dark:text-gray-300">{finding.file}:{finding.line}</span></div>
                    <div className="mt-1 font-medium">Message: <span className="text-gray-700 dark:text-gray-300">{finding.message}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different sections */}
      <Tabs defaultValue="findings">
        <TabsList className="flex mb-6 border-b-0 gap-1">
          <TabsTrigger value="findings" className="text-base font-medium py-3 px-6 rounded-t-lg border-2 border-b-0 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-500 data-[state=active]:shadow-sm bg-blue-100 text-blue-700">All Findings</TabsTrigger>
          <TabsTrigger value="affected-files" className="text-base font-medium py-3 px-6 rounded-t-lg border-2 border-b-0 data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:border-red-500 data-[state=active]:shadow-sm bg-red-100 text-red-700">Most Affected Files</TabsTrigger>
          <TabsTrigger value="recommendations" className="text-base font-medium py-3 px-6 rounded-t-lg border-2 border-b-0 data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:border-green-500 data-[state=active]:shadow-sm bg-green-100 text-green-700">Recommendations</TabsTrigger>
          <TabsTrigger value="next-steps" className="text-base font-medium py-3 px-6 rounded-t-lg border-2 border-b-0 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:border-purple-500 data-[state=active]:shadow-sm bg-purple-100 text-purple-700">Next Steps</TabsTrigger>
        </TabsList>
        
        {/* All Findings Tab */}
        <TabsContent value="findings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Findings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="p-2 text-left">Priority</th>
                      <th className="p-2 text-left">Severity</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">File</th>
                      <th className="p-2 text-left">Line</th>
                      <th className="p-2 text-left">CWE</th>
                      <th className="p-2 text-left">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.findings.map((finding) => (
                      <tr key={finding.id} className="border-t hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">
                        <td className="p-2">{getPriorityBadge(finding.priority_rank)}</td>
                        <td className="p-2">
                          <Badge className={getSeverityColor(finding.severity)}>
                            <span className="mr-1">{finding.severity_emoji}</span>
                            {finding.severity}
                          </Badge>
                        </td>
                        <td className="p-2">{finding.type}</td>
                        <td className="p-2 max-w-[200px] truncate" title={finding.file}>{finding.file}</td>
                        <td className="p-2">{finding.line}</td>
                        <td className="p-2">{finding.cwe}</td>
                        <td className="p-2">
                          <Badge className={getConfidenceColor(finding.confidence_label)}>
                            {finding.confidence_label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Most Affected Files Tab */}
        <TabsContent value="affected-files">
          <Card>
            <CardHeader>
              <CardTitle>Most Affected Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scanResults.most_affected_files && scanResults.most_affected_files.length > 0 ? (
                  scanResults.most_affected_files.map((file, index) => (
                    <div key={index} className="p-4 border-2 border-gray-300 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="font-medium truncate max-w-[70%] text-white dark:text-white" title={file.file_path || file.filename}>
                          <FileText className="h-4 w-4 inline mr-2 text-white" />
                          <span className="font-semibold text-white">File: </span>
                          <span className="font-semibold text-white dark:text-white bg-gray-700 px-2 py-1 rounded">
                            {file.file_path || file.filename || ""}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-gray-100 dark:bg-gray-700">
                            {file.issue_count} issues
                          </Badge>
                          {file.critical_count > 0 && (
                            <Badge className="bg-[#e74c3c] text-white">
                              {file.critical_count} critical
                            </Badge>
                          )}
                          {file.high_count > 0 && (
                            <Badge className="bg-[#e67e22] text-white">
                              {file.high_count} high
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          Affected lines: {file.lines_affected?.join(", ")}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <div className="text-gray-500 dark:text-gray-400">No affected files data available</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 space-y-6">
                {scanResults.findings.slice(0, 5).map((finding, index) => (
                  <li key={index} className="pl-2">
                    <div className="space-y-3">
                      <div className="font-medium">{finding.message}</div>
                      
                      {/* Vulnerable Code Snippet */}
                      <div className="mt-2">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vulnerable Code:</div>
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md font-mono text-sm overflow-x-auto">
                          <pre className="whitespace-pre-wrap">{finding.snippet}</pre>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          File: {finding.file}, Line: {finding.line}
                        </div>
                      </div>
                      
                      {/* Recommendation */}
                      <div className="mt-3">
                        <div className="text-base font-bold text-white mb-2">Recommended Fix:</div>
                        <div className="bg-emerald-900/40 border-2 border-emerald-500 p-4 rounded-md font-mono text-sm overflow-x-auto shadow-lg">
                          <pre className="whitespace-pre-wrap text-emerald-100">{finding.remediation}</pre>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                
                {/* General Recommendations */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-3">General Recommendations</h3>
                  <ul className="space-y-2">
                    {scanResults.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Next Steps Tab */}
        <TabsContent value="next-steps">
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scanResults.next_steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 p-2 border-b last:border-b-0">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>{step}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScanResultsDisplay;