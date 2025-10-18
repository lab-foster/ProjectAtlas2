// Budget Tracker Backend API - Complete Implementation
// Node.js + Express + PostgreSQL

const express = require('express');
const multer = require('multer');
const { body, param, query, validationResult } = require('express-validator');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const app = express();
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware (simplified)
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }
  
  try {
    // In production, verify JWT token
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.userId = decoded.userId;
    req.userId = 1; // Simplified for example
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============================================================
// PROJECT ENDPOINTS
// ============================================================

/**
 * GET /api/projects
 * Fetch all projects with budget data for the authenticated user
 */
app.get('/api/projects', authenticateUser, async (req, res) => {
  try {
    const projectsQuery = `
      SELECT 
        p.id,
        p.name,
        p.budget,
        p.created_at,
        p.updated_at,
        COALESCE(SUM(e.amount), 0) as spent,
        COUNT(e.id) as expense_count
      FROM projects p
      LEFT JOIN expenses e ON e.project_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    
    const projectsResult = await pool.query(projectsQuery, [req.userId]);
    
    // Fetch categories for each project
    const projectsWithCategories = await Promise.all(
      projectsResult.rows.map(async (project) => {
        const categoriesQuery = `
          SELECT 
            c.name,
            COALESCE(SUM(e.amount), 0) as amount
          FROM categories c
          LEFT JOIN expenses e ON e.category_id = c.id AND e.project_id = $1
          WHERE c.project_id = $1
          GROUP BY c.id, c.name
          ORDER BY amount DESC
        `;
        
        const categoriesResult = await pool.query(categoriesQuery, [project.id]);
        
        const spent = parseFloat(project.spent);
        const budget = parseFloat(project.budget);
        const isOver = spent > budget;
        
        return {
          id: project.id,
          name: project.name,
          budget: budget,
          spent: spent,
          status: isOver ? `$${(spent - budget).toFixed(2)} OVER` : 'ON TRACK',
          statusType: isOver ? 'over' : 'on-track',
          onTrack: !isOver,
          expenseCount: parseInt(project.expense_count),
          categories: categoriesResult.rows.map(cat => ({
            name: cat.name,
            amount: parseFloat(cat.amount)
          })),
          createdAt: project.created_at,
          updatedAt: project.updated_at
        };
      })
    );
    
    res.json({
      projects: projectsWithCategories,
      summary: calculateSummary(projectsWithCategories)
    });
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/:id
 * Fetch single project details
 */
app.get('/api/projects/:id', 
  authenticateUser,
  param('id').isInt(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const projectQuery = `
        SELECT 
          p.*,
          COALESCE(SUM(e.amount), 0) as spent
        FROM projects p
        LEFT JOIN expenses e ON e.project_id = p.id
        WHERE p.id = $1 AND p.user_id = $2
        GROUP BY p.id
      `;
      
      const result = await pool.query(projectQuery, [req.params.id, req.userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      res.json({ project: result.rows[0] });
      
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  }
);

/**
 * PUT /api/projects/:id/budget
 * Update project budget
 */
app.put('/api/projects/:id/budget',
  authenticateUser,
  param('id').isInt(),
  body('budget').isFloat({ min: 0 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const updateQuery = `
        UPDATE projects 
        SET budget = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, [
        req.body.budget,
        req.params.id,
        req.userId
      ]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      res.json({ 
        project: result.rows[0],
        message: 'Budget updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating project budget:', error);
      res.status(500).json({ error: 'Failed to update budget' });
    }
  }
);

// ============================================================
// EXPENSE ENDPOINTS
// ============================================================

/**
 * GET /api/expenses
 * Fetch expenses with pagination and filtering
 */
app.get('/api/expenses',
  authenticateUser,
  query('page').optional().isInt({ min: 1 }),
  query('per_page').optional().isInt({ min: 1, max: 100 }),
  query('project_id').optional().isInt(),
  query('category_id').optional().isInt(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 20;
      const offset = (page - 1) * perPage;
      
      let whereClause = 'WHERE e.user_id = $1';
      const params = [req.userId];
      let paramIndex = 2;
      
      if (req.query.project_id) {
        whereClause += ` AND e.project_id = $${paramIndex}`;
        params.push(req.query.project_id);
        paramIndex++;
      }
      
      if (req.query.category_id) {
        whereClause += ` AND e.category_id = $${paramIndex}`;
        params.push(req.query.category_id);
        paramIndex++;
      }
      
      const expensesQuery = `
        SELECT 
          e.id,
          e.title,
          e.description,
          e.amount,
          e.date,
          e.receipt_url,
          e.notes,
          e.created_at,
          p.name as project_name,
          p.id as project_id,
          c.name as category_name,
          c.id as category_id
        FROM expenses e
        JOIN projects p ON p.id = e.project_id
        LEFT JOIN categories c ON c.id = e.category_id
        ${whereClause}
        ORDER BY e.date DESC, e.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(perPage, offset);
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM expenses e
        ${whereClause}
      `;
      
      const [expensesResult, countResult] = await Promise.all([
        pool.query(expensesQuery, params),
        pool.query(countQuery, params.slice(0, -2))
      ]);
      
      const total = parseInt(countResult.rows[0].total);
      
      res.json({
        expenses: expensesResult.rows.map(formatExpense),
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage)
        }
      });
      
    } catch (error) {
      console.error('Error fetching expenses:', error);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  }
);

/**
 * GET /api/expenses/:id
 * Fetch single expense details
 */
app.get('/api/expenses/:id',
  authenticateUser,
  param('id').isInt(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const expenseQuery = `
        SELECT 
          e.*,
          p.name as project_name,
          c.name as category_name
        FROM expenses e
        JOIN projects p ON p.id = e.project_id
        LEFT JOIN categories c ON c.id = e.category_id
        WHERE e.id = $1 AND e.user_id = $2
      `;
      
      const result = await pool.query(expenseQuery, [req.params.id, req.userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json({ expense: formatExpense(result.rows[0]) });
      
    } catch (error) {
      console.error('Error fetching expense:', error);
      res.status(500).json({ error: 'Failed to fetch expense' });
    }
  }
);

/**
 * POST /api/expenses
 * Create new expense
 */
app.post('/api/expenses',
  authenticateUser,
  body('title').notEmpty().trim(),
  body('amount').isFloat({ min: 0 }),
  body('date').isISO8601(),
  body('project_id').isInt(),
  body('category_id').optional().isInt(),
  body('description').optional().trim(),
  body('notes').optional().trim(),
  handleValidationErrors,
  async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify project ownership
      const projectCheck = await client.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [req.body.project_id, req.userId]
      );
      
      if (projectCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const insertQuery = `
        INSERT INTO expenses (
          user_id, project_id, category_id, title, description,
          amount, date, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `;
      
      const result = await client.query(insertQuery, [
        req.userId,
        req.body.project_id,
        req.body.category_id || null,
        req.body.title,
        req.body.description || null,
        req.body.amount,
        req.body.date,
        req.body.notes || null
      ]);
      
      await client.query('COMMIT');
      
      res.status(201).json({
        expense: formatExpense(result.rows[0]),
        message: 'Expense created successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating expense:', error);
      res.status(500).json({ error: 'Failed to create expense' });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/expenses/:id
 * Update expense
 */
app.put('/api/expenses/:id',
  authenticateUser,
  param('id').isInt(),
  body('title').optional().notEmpty().trim(),
  body('amount').optional().isFloat({ min: 0 }),
  body('date').optional().isISO8601(),
  body('description').optional().trim(),
  body('notes').optional().trim(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      const allowedFields = ['title', 'amount', 'date', 'description', 'notes', 'category_id'];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
          paramIndex++;
        }
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(req.params.id, req.userId);
      
      const updateQuery = `
        UPDATE expenses
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING *
      `;
      
      const result = await pool.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json({
        expense: formatExpense(result.rows[0]),
        message: 'Expense updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating expense:', error);
      res.status(500).json({ error: 'Failed to update expense' });
    }
  }
);

/**
 * DELETE /api/expenses/:id
 * Delete expense
 */
app.delete('/api/expenses/:id',
  authenticateUser,
  param('id').isInt(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const deleteQuery = `
        DELETE FROM expenses
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;
      
      const result = await pool.query(deleteQuery, [req.params.id, req.userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json({ message: 'Expense deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  }
);

/**
 * POST /api/expenses/upload
 * Upload receipt image
 */
app.post('/api/expenses/upload',
  authenticateUser,
  upload.single('receipt'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // In production, upload to S3/Cloud Storage
      const receiptUrl = `/uploads/${req.file.filename}`;
      
      res.json({
        url: receiptUrl,
        filename: req.file.originalname,
        size: req.file.size,
        message: 'Receipt uploaded successfully'
      });
      
    } catch (error) {
      console.error('Error uploading receipt:', error);
      res.status(500).json({ error: 'Failed to upload receipt' });
    }
  }
);

// ============================================================
// CATEGORY ENDPOINTS
// ============================================================

/**
 * GET /api/expenses/categories
 * Fetch all expense categories
 */
app.get('/api/expenses/categories', authenticateUser, async (req, res) => {
  try {
    const categoriesQuery = `
      SELECT id, name, description, icon
      FROM categories
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY name
    `;
    
    const result = await pool.query(categoriesQuery, [req.userId]);
    
    res.json({ categories: result.rows });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ============================================================
// REPORT ENDPOINTS
// ============================================================

/**
 * POST /api/reports/generate
 * Generate budget report
 */
app.post('/api/reports/generate',
  authenticateUser,
  body('format').isIn(['pdf', 'excel']),
  body('date_from').optional().isISO8601(),
  body('date_to').optional().isISO8601(),
  body('project_ids').optional().isArray(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { format, date_from, date_to, project_ids } = req.body;
      
      // Fetch data for report
      const reportData = await fetchReportData(req.userId, {
        dateFrom: date_from,
        dateTo: date_to,
        projectIds: project_ids
      });
      
      if (format === 'pdf') {
        const pdfBuffer = await generatePDFReport(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=budget-report.pdf');
        res.send(pdfBuffer);
      } else if (format === 'excel') {
        const excelBuffer = await generateExcelReport(reportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=budget-report.xlsx');
        res.send(excelBuffer);
      }
      
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
);

// ============================================================
// INSIGHTS ENDPOINTS
// ============================================================

/**
 * GET /api/insights
 * Fetch budget insights and analytics
 */
app.get('/api/insights', authenticateUser, async (req, res) => {
  try {
    const insights = await generateBudgetInsights(req.userId);
    res.json({ insights });
    
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatExpense(expense) {
  return {
    id: expense.id,
    title: expense.title,
    description: expense.description,
    amount: parseFloat(expense.amount),
    date: expense.date,
    project: expense.project_name,
    projectId: expense.project_id,
    category: expense.category_name,
    categoryId: expense.category_id,
    receiptUrl: expense.receipt_url,
    notes: expense.notes,
    createdAt: expense.created_at
  };
}

function calculateSummary(projects) {
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0);
  const remaining = totalBudget - totalSpent;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  
  return {
    totalBudget,
    totalSpent,
    remaining,
    percentUsed: parseFloat(percentUsed.toFixed(2)),
    projectedTotal: calculateProjectedTotal(projects)
  };
}

function calculateProjectedTotal(projects) {
  // Simple projection based on spending velocity
  // In production, use more sophisticated forecasting
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0);
  return totalSpent * 1.94; // Example multiplier
}

async function fetchReportData(userId, filters) {
  let whereClause = 'WHERE e.user_id = $1';
  const params = [userId];
  let paramIndex = 2;
  
  if (filters.dateFrom) {
    whereClause += ` AND e.date >= $${paramIndex}`;
    params.push(filters.dateFrom);
    paramIndex++;
  }
  
  if (filters.dateTo) {
    whereClause += ` AND e.date <= $${paramIndex}`;
    params.push(filters.dateTo);
    paramIndex++;
  }
  
  if (filters.projectIds && filters.projectIds.length > 0) {
    whereClause += ` AND e.project_id = ANY($${paramIndex})`;
    params.push(filters.projectIds);
    paramIndex++;
  }
  
  const query = `
    SELECT 
      p.name as project_name,
      p.budget,
      c.name as category_name,
      e.title,
      e.amount,
      e.date
    FROM expenses e
    JOIN projects p ON p.id = e.project_id
    LEFT JOIN categories c ON c.id = e.category_id
    ${whereClause}
    ORDER BY e.date DESC
  `;
  
  const result = await pool.query(query, params);
  return result.rows;
}

async function generatePDFReport(data) {
  const doc = new PDFDocument();
  const chunks = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  doc.fontSize(20).text('Budget Report', { align: 'center' });
  doc.moveDown();
  
  // Add report content
  data.forEach(item => {
    doc.fontSize(12).text(`${item.title} - $${item.amount}`, { continued: true });
    doc.text(` (${item.project_name})`, { align: 'right' });
  });
  
  doc.end();
  
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function generateExcelReport(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Budget Report');
  
  worksheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Project', key: 'project_name', width: 30 },
    { header: 'Category', key: 'category_name', width: 20 },
    { header: 'Description', key: 'title', width: 40 },
    { header: 'Amount', key: 'amount', width: 12 }
  ];
  
  data.forEach(item => {
    worksheet.addRow(item);
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

async function generateBudgetInsights(userId) {
  // Implement sophisticated analytics
  // This is a simplified version
  
  const insights = [];
  
  // Spending trend analysis
  const trendQuery = `
    SELECT 
      DATE_TRUNC('month', date) as month,
      SUM(amount) as total
    FROM expenses
    WHERE user_id = $1 
      AND date >= NOW() - INTERVAL '3 months'
    GROUP BY month
    ORDER BY month
  `;
  
  const trendResult = await pool.query(trendQuery, [userId]);
  
  if (trendResult.rows.length >= 2) {
    const current = parseFloat(trendResult.rows[trendResult.rows.length - 1].total);
    const previous = parseFloat(trendResult.rows[trendResult.rows.length - 2].total);
    const change = ((current - previous) / previous) * 100;
    
    insights.push({
      type: 'spending_trend',
      title: 'Spending Trend',
      message: `Your spending has ${change > 0 ? 'increased' : 'decreased'} ${Math.abs(change).toFixed(1)}% this month compared to last month.`,
      severity: change > 15 ? 'warning' : 'info'
    });
  }
  
  return insights;
}

// ============================================================
// DATABASE SCHEMA (for reference)
// ============================================================

/*
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  project_id INTEGER,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  category_id INTEGER,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  receipt_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_expenses_date ON expenses(date);
*/

// ============================================================
// SERVER STARTUP
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Budget Tracker API server running on port ${PORT}`);
});

module.exports = app;
