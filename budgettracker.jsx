import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  BarChart3,
  Plus,
  Download,
  Upload,
  X,
  FileText,
  Calendar,
  Tag,
  Receipt
} from 'lucide-react';

// Budget Tracker Component
const BudgetTracker = () => {
  // State management
  const [showLoadExpensesModal, setShowLoadExpensesModal] = useState(false);
  const [showExpenseDetailsModal, setShowExpenseDetailsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [visibleExpenses, setVisibleExpenses] = useState(5);

  // Form state for adding new expense
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    project: '',
    category: '',
    receipt: null,
    notes: ''
  });

  // Sample data structure
  const [projectsData] = useState([
    {
      id: 1,
      name: 'Kitchen Renovation Epic',
      budget: 20000,
      spent: 23400,
      status: '$600 OVER',
      statusType: 'over',
      onTrack: false,
      categories: [
        { name: 'Materials', amount: 18200 },
        { name: 'Labor', amount: 4800 },
        { name: 'Permits', amount: 400 }
      ]
    },
    {
      id: 2,
      name: 'Basement Finishing Epic',
      budget: 35000,
      spent: 5200,
      status: 'ON TRACK',
      statusType: 'on-track',
      onTrack: true,
      categories: [
        { name: 'Planning & Permits', amount: 1200 },
        { name: 'Materials (partial)', amount: 4000 }
      ]
    },
    {
      id: 3,
      name: 'Bathroom Update Epic',
      budget: 12000,
      spent: 8100,
      status: 'ON TRACK',
      statusType: 'on-track',
      onTrack: true,
      categories: [
        { name: 'Fixtures', amount: 3200 },
        { name: 'Plumbing', amount: 2800 },
        { name: 'Materials', amount: 2100 }
      ]
    }
  ]);

  const [allExpenses] = useState([
    {
      id: 1,
      title: 'Tile grout and spacers',
      project: 'Kitchen Renovation',
      projectColor: 'red',
      time: '2 hours ago',
      amount: 127.43
    },
    {
      id: 2,
      title: 'Cabinet hardware and hinges',
      project: 'Kitchen Renovation',
      projectColor: 'blue',
      time: 'Yesterday',
      amount: 324.67
    },
    {
      id: 3,
      title: 'Electrician - rough-in work',
      project: 'Basement Finishing',
      projectColor: 'orange',
      time: '3 days ago',
      amount: 1200.00
    },
    {
      id: 4,
      title: 'Countertop installation',
      project: 'Kitchen Renovation',
      projectColor: 'brown',
      time: '5 days ago',
      amount: 3800.00
    },
    {
      id: 5,
      title: 'Building permit renewal',
      project: 'Bathroom Update',
      projectColor: 'purple',
      time: '1 week ago',
      amount: 200.00
    },
    {
      id: 6,
      title: 'Drywall materials',
      project: 'Basement Finishing',
      projectColor: 'orange',
      time: '1 week ago',
      amount: 850.00
    },
    {
      id: 7,
      title: 'Paint and primer supplies',
      project: 'Kitchen Renovation',
      projectColor: 'red',
      time: '2 weeks ago',
      amount: 289.50
    },
    {
      id: 8,
      title: 'HVAC ductwork',
      project: 'Basement Finishing',
      projectColor: 'orange',
      time: '2 weeks ago',
      amount: 1650.00
    }
  ]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalBudget = projectsData.reduce((sum, p) => sum + p.budget, 0);
    const totalSpent = projectsData.reduce((sum, p) => sum + p.spent, 0);
    const remaining = totalBudget - totalSpent;
    const percentUsed = (totalSpent / totalBudget) * 100;
    
    // Calculate projected total based on current spending rate
    const projectedTotal = totalSpent * 1.94; // Example projection logic
    
    return {
      totalBudget,
      totalSpent,
      remaining,
      percentUsed,
      projectedTotal
    };
  }, [projectsData]);

  // Handle expense detail view
  const handleViewExpense = (expense) => {
    setSelectedExpense(expense);
    setShowExpenseDetailsModal(true);
  };

  // Handle load more expenses
  const handleLoadMoreExpenses = () => {
    setShowLoadExpensesModal(true);
  };

  const confirmLoadMore = () => {
    setVisibleExpenses(prev => Math.min(prev + 5, allExpenses.length));
    setShowLoadExpensesModal(false);
  };

  // Handle add expense
  const handleAddExpense = () => {
    setShowAddExpenseModal(true);
  };

  const handleExpenseInputChange = (field, value) => {
    setNewExpense(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewExpense(prev => ({ ...prev, receipt: file }));
    }
  };

  const submitNewExpense = () => {
    // In production, this would send to backend API
    console.log('Submitting new expense:', newExpense);
    
    // Reset form
    setNewExpense({
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      project: '',
      category: '',
      receipt: null,
      notes: ''
    });
    
    setShowAddExpenseModal(false);
  };

  // Handle report generation
  const handleGenerateReport = () => {
    setShowReportModal(true);
  };

  const generateReport = (format) => {
    console.log(`Generating ${format} report with options`);
    // In production, this would trigger report generation
    setShowReportModal(false);
  };

  // Get project icon color
  const getProjectIconColor = (color) => {
    const colors = {
      red: 'bg-red-100 text-red-600',
      blue: 'bg-blue-100 text-blue-600',
      orange: 'bg-orange-100 text-orange-600',
      brown: 'bg-amber-100 text-amber-700',
      purple: 'bg-purple-100 text-purple-600'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-light text-gray-900">
                Project <span className="text-blue-600 font-medium">ATLAS</span>
              </h1>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Home Project Management</p>
            </div>
            
            <nav className="flex items-center space-x-8">
              <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">Dashboard</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">Projects</a>
              <a href="#" className="text-blue-600 font-medium text-sm border-b-2 border-blue-600 pb-4">Budget</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">Calendar</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">Documents</a>
              
              <button
                onClick={handleAddExpense}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
              
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                AF
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title and Actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-light text-gray-900">Budget Tracker</h2>
          </div>
          
          <button
            onClick={handleGenerateReport}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Generate Report</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 uppercase tracking-wide">Total Budget</span>
            </div>
            <div className="text-3xl font-light text-blue-600 mb-1">
              ${summaryMetrics.totalBudget.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">Across all projects</p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 uppercase tracking-wide">Total Spent</span>
            </div>
            <div className="text-3xl font-light text-orange-600 mb-1">
              ${summaryMetrics.totalSpent.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">{summaryMetrics.percentUsed.toFixed(0)}% of budget used</p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 uppercase tracking-wide">Remaining</span>
            </div>
            <div className="text-3xl font-light text-green-600 mb-1">
              ${summaryMetrics.remaining.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">{(100 - summaryMetrics.percentUsed).toFixed(0)}% available</p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 uppercase tracking-wide">Projected Total</span>
            </div>
            <div className="text-3xl font-light text-blue-700 mb-1">
              ${summaryMetrics.projectedTotal.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">Based on current rate</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Project Budgets - Left Side */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Project Budgets</h3>
              </div>
              
              <div className="p-6 space-y-6">
                {projectsData.map((project) => {
                  const percentage = (project.spent / project.budget) * 100;
                  const isOverBudget = project.spent > project.budget;
                  
                  return (
                    <div key={project.id} className="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-base font-medium text-gray-900">{project.name}</h4>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          project.statusType === 'over' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                          <span className="font-medium">${project.spent.toLocaleString()} spent</span>
                          <span className="text-gray-500">/ ${project.budget.toLocaleString()} budget</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isOverBudget ? 'bg-red-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Category Breakdown */}
                      <div className="space-y-2 mt-4">
                        {project.categories.map((category, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{category.name}</span>
                            <span className="font-medium text-gray-900">
                              ${category.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Expenses - Right Side */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-24">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Expenses</h3>
              </div>
              
              <div className="divide-y divide-gray-100">
                {allExpenses.slice(0, visibleExpenses).map((expense) => (
                  <button
                    key={expense.id}
                    onClick={() => handleViewExpense(expense)}
                    className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${getProjectIconColor(expense.projectColor)}`}>
                        <Receipt className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {expense.title}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span className="text-blue-600">{expense.project}</span>
                          <span>•</span>
                          <span>{expense.time}</span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          ${expense.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {visibleExpenses < allExpenses.length && (
                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={handleLoadMoreExpenses}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Load More Expenses
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Budget Insights */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Insights</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-yellow-600" />
                </div>
                <h4 className="font-medium text-gray-900">Spending Trend</h4>
              </div>
              <p className="text-sm text-gray-600">
                Your spending has increased 15% this month compared to last month. Consider reviewing high-cost items.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h4 className="font-medium text-gray-900">Budget Alert</h4>
              </div>
              <p className="text-sm text-gray-600">
                Kitchen Renovation is $600 over budget. You may want to adjust remaining expenses or increase the budget.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-900">Forecast</h4>
              </div>
              <p className="text-sm text-gray-600">
                At your current spending rate, you'll finish under budget by approximately $3,800 across all projects.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Load More Expenses */}
      {showLoadExpensesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900 mb-2">lab-foster.github.io says</p>
              <p className="text-sm text-gray-700 mb-2">📊 Load More Expenses</p>
              <p className="text-sm text-gray-600 mb-4">This will load additional expense entries.</p>
              <p className="text-sm text-gray-500 italic">Coming soon!</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLoadExpensesModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={confirmLoadMore}
                className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Expense Details */}
      {showExpenseDetailsModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl">
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-900 mb-4">lab-foster.github.io says</p>
              <p className="text-sm text-gray-700 mb-4">📄 Expense Details</p>
              
              <div className="bg-gray-50 rounded p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">{selectedExpense.title}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-gray-900">${selectedExpense.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Project:</span>
                    <span className="text-blue-600">{selectedExpense.project}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="text-gray-900">{selectedExpense.time}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                <p className="font-medium mb-2">View:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Full expense information</li>
                  <li>Receipt/invoice images</li>
                  <li>Project assignment</li>
                  <li>Edit/delete options</li>
                  <li>Related expenses</li>
                </ul>
              </div>
              <p className="text-sm text-gray-500 italic mt-4">Coming soon!</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowExpenseDetailsModal(false)}
                className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Generate Report */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-900 mb-4">lab-foster.github.io says</p>
              <p className="text-sm text-gray-700 mb-4">📊 Generate Budget Report</p>
              
              <div className="text-sm text-gray-600 mb-2">
                <p className="font-medium mb-2">Report options:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Expense breakdown by project</li>
                  <li>Cost comparisons</li>
                  <li>Spending trends</li>
                  <li>Budget forecasting</li>
                  <li>Export to PDF/Excel</li>
                </ul>
              </div>
              <p className="text-sm text-gray-500 italic mt-4">Coming soon!</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => generateReport('pdf')}
                className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Expense */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">lab-foster.github.io says</p>
                <p className="text-sm text-gray-700">💰 Add New Expense</p>
              </div>
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Description
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => handleExpenseInputChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Cabinet hardware purchase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newExpense.amount}
                    onChange={(e) => handleExpenseInputChange('amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => handleExpenseInputChange('date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project
                </label>
                <select
                  value={newExpense.project}
                  onChange={(e) => handleExpenseInputChange('project', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a project...</option>
                  {projectsData.map((project) => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Category
                </label>
                <select
                  value={newExpense.category}
                  onChange={(e) => handleExpenseInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category...</option>
                  <option value="materials">Materials</option>
                  <option value="labor">Labor</option>
                  <option value="permits">Permits</option>
                  <option value="equipment">Equipment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Receipt className="w-4 h-4 inline mr-1" />
                  Receipt Upload
                </label>
                <div className="flex items-center space-x-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded hover:border-blue-500 transition-colors text-center">
                      <Upload className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {newExpense.receipt ? newExpense.receipt.name : 'Click to upload receipt'}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={newExpense.notes}
                  onChange={(e) => handleExpenseInputChange('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional details..."
                />
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-4">
              <p className="font-medium mb-2">Form fields:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                <li>Description</li>
                <li>Amount and date</li>
                <li>Project</li>
                <li>Category (materials/labor/permits)</li>
                <li>Receipt upload</li>
                <li>Notes</li>
              </ul>
              <p className="text-gray-500 italic mt-3">Coming soon!</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAddExpenseModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={submitNewExpense}
                className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetTracker;
