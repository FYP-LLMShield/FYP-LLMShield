"""
Dataset Poisoning Detection Service
====================================
Implements poisoning detection for datasets using 8 different techniques.
"""

import logging
import json
import csv
import io
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from scipy import stats
import numpy as np
import pandas as pd

from app.models.dataset_poisoning import (
    DatasetAnalysisResult,
    DatasetVerdictType,
    DetectionResult,
    DetectionTechniqueType,
    SuspiciousSample,
)

logger = logging.getLogger(__name__)


class DatasetPoisoningDetector:
    """
    Detects data poisoning in datasets using 8 different techniques.
    """

    def __init__(self):
        self.analysis_results: Dict[str, DatasetAnalysisResult] = {}

    async def analyze_dataset(
        self,
        dataset_name: str,
        input_method: str,
        dataset_content: Optional[str] = None,
        sample_size: Optional[int] = None,
    ) -> DatasetAnalysisResult:
        """
        Analyze dataset for poisoning indicators.
        """
        analysis_id = str(uuid.uuid4())
        logger.info(f"Starting dataset analysis: {dataset_name} (analysis_id: {analysis_id})")

        try:
            # Parse dataset based on input method
            df = self._parse_dataset(dataset_content, input_method)
            if df is None or df.empty:
                raise ValueError("Could not parse dataset or dataset is empty")

            # Sample if dataset is too large
            if sample_size and len(df) > sample_size:
                df = df.sample(n=sample_size, random_state=42)

            logger.info(f"Dataset shape: {df.shape}")

            # Run 8 detection techniques
            detection_results = await self._run_detection_techniques(df)

            # Find suspicious samples
            suspicious_samples = self._find_suspicious_samples(df, detection_results)

            # Assess overall risk
            overall_risk, verdict, confidence, explanation = self._assess_risk(
                detection_results, suspicious_samples, len(df)
            )

            # Generate recommendation
            recommendation = self._generate_recommendation(verdict, overall_risk)

            # Build result
            result = DatasetAnalysisResult(
                analysis_id=analysis_id,
                dataset_name=dataset_name,
                input_method=input_method,
                verdict=verdict,
                confidence=confidence,
                explanation=explanation,
                detection_results=detection_results,
                suspicious_samples=suspicious_samples[:10],  # Top 10
                total_samples=len(df),
                total_features=len(df.columns),
                suspicious_sample_count=len(suspicious_samples),
                overall_risk_score=overall_risk,
                recommendation=recommendation,
                summary_metrics=self._build_summary_metrics(df),
                status="completed",
            )

            self.analysis_results[analysis_id] = result
            logger.info(f"Analysis completed: {verdict}")
            return result

        except Exception as e:
            logger.error(f"Analysis failed: {str(e)}", exc_info=True)
            return DatasetAnalysisResult(
                analysis_id=analysis_id,
                dataset_name=dataset_name,
                input_method=input_method,
                verdict=DatasetVerdictType.UNKNOWN,
                confidence=0.0,
                explanation=f"Analysis failed: {str(e)}",
                detection_results=[],
                overall_risk_score=0.5,
                recommendation="Could not complete analysis. Please check dataset format.",
                status="failed",
                error_message=str(e),
            )

    def _parse_dataset(self, content: str, input_method: str) -> Optional[pd.DataFrame]:
        """Parse dataset from various formats."""
        try:
            if not content:
                return None

            # Try JSON first
            try:
                data = json.loads(content)
                if isinstance(data, list):
                    return pd.DataFrame(data)
                elif isinstance(data, dict):
                    return pd.DataFrame([data])
            except:
                pass

            # Try CSV
            try:
                return pd.read_csv(io.StringIO(content))
            except:
                pass

            # Try TSV
            try:
                return pd.read_csv(io.StringIO(content), sep="\t")
            except:
                pass

            # Try newline-delimited JSON
            try:
                lines = content.strip().split("\n")
                data = [json.loads(line) for line in lines if line]
                return pd.DataFrame(data)
            except:
                pass

            logger.error(f"Could not parse dataset")
            return None

        except Exception as e:
            logger.error(f"Parse error: {e}")
            return None

    async def _run_detection_techniques(self, df: pd.DataFrame) -> List[DetectionResult]:
        """Run all 8 detection techniques."""
        results = []

        # 1. Statistical Anomalies
        results.append(self._detect_statistical_anomalies(df))

        # 2. Label Poisoning
        results.append(self._detect_label_poisoning(df))

        # 3. Text Analysis (if text columns exist)
        results.append(self._detect_text_anomalies(df))

        # 4. Data Integrity
        results.append(self._check_data_integrity(df))

        # 5. Correlation Analysis
        results.append(self._analyze_correlations(df))

        # 6. Metadata Analysis
        results.append(self._analyze_metadata(df))

        # 7. Sample Patterns
        results.append(self._detect_sample_patterns(df))

        # 8. Distribution Tests
        results.append(self._test_distributions(df))

        return results

    def _detect_statistical_anomalies(self, df: pd.DataFrame) -> DetectionResult:
        """Detect statistical anomalies in numerical columns."""
        findings = []
        risk_score = 0
        numeric_cols = df.select_dtypes(include=[np.number]).columns

        for col in numeric_cols:
            data = df[col].dropna()
            if len(data) < 3:
                continue

            # Check for outliers using IQR
            Q1 = data.quantile(0.25)
            Q3 = data.quantile(0.75)
            IQR = Q3 - Q1
            outlier_threshold = 1.5 * IQR
            outliers = ((data < Q1 - outlier_threshold) | (data > Q3 + outlier_threshold)).sum()
            outlier_pct = (outliers / len(data)) * 100

            if outlier_pct > 5:
                findings.append(f"Column '{col}': {outlier_pct:.1f}% outliers (abnormal)")
                risk_score += 0.1

            # Check Z-scores
            z_scores = np.abs(stats.zscore(data))
            extreme = (z_scores > 3).sum()
            if extreme > len(data) * 0.02:
                findings.append(f"Column '{col}': {extreme} extreme values (Z-score > 3)")
                risk_score += 0.1

        return DetectionResult(
            technique=DetectionTechniqueType.STATISTICAL,
            passed=risk_score == 0,
            confidence=0.85,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"numeric_columns": len(numeric_cols), "anomalies_found": len(findings)},
        )

    def _detect_label_poisoning(self, df: pd.DataFrame) -> DetectionResult:
        """Detect label poisoning patterns."""
        findings = []
        risk_score = 0

        # Check for obvious label columns
        label_cols = [col for col in df.columns if col.lower() in ["label", "target", "class", "y"]]

        for col in label_cols:
            if col not in df.columns:
                continue

            value_counts = df[col].value_counts()
            total = len(df)

            # Check for extreme imbalance
            if len(value_counts) > 1:
                max_ratio = value_counts.iloc[0] / total
                min_ratio = value_counts.iloc[-1] / total

                if max_ratio > 0.95:
                    findings.append(f"Column '{col}': Extreme class imbalance ({max_ratio:.1%} dominant)")
                    risk_score += 0.15

                if min_ratio < 0.01 and len(value_counts) > 2:
                    findings.append(f"Column '{col}': Rare class ({min_ratio:.1%} occurrence)")
                    risk_score += 0.1

            # Check for suspicious patterns in label values
            if df[col].dtype == "object":
                unique_vals = df[col].unique()
                if len(unique_vals) > 100:
                    findings.append(f"Column '{col}': Too many unique values ({len(unique_vals)})")
                    risk_score += 0.1

        return DetectionResult(
            technique=DetectionTechniqueType.LABEL_ANALYSIS,
            passed=risk_score == 0,
            confidence=0.80,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"label_columns_found": len(label_cols), "imbalance_issues": len(findings)},
        )

    def _detect_text_anomalies(self, df: pd.DataFrame) -> DetectionResult:
        """Detect anomalies in text data."""
        findings = []
        risk_score = 0
        text_cols = df.select_dtypes(include=["object"]).columns

        dangerous_patterns = [
            (r"eval\(", "eval() code execution"),
            (r"exec\(", "exec() code execution"),
            (r"__import__", "import injection"),
            (r"<script", "JavaScript injection"),
            (r"SELECT.*FROM", "SQL injection"),
            (r"' OR '", "SQL injection"),
            (r"../", "Path traversal"),
            (r"<iframe", "IFrame injection"),
        ]

        for col in text_cols:
            if col not in df.columns or df[col].dtype != "object":
                continue

            text_data = df[col].astype(str)

            for pattern, threat in dangerous_patterns:
                matches = text_data.str.contains(pattern, case=False, regex=True).sum()
                if matches > 0:
                    findings.append(f"Column '{col}': {matches} instances of {threat}")
                    risk_score += 0.15

        return DetectionResult(
            technique=DetectionTechniqueType.TEXT_ANALYSIS,
            passed=risk_score == 0,
            confidence=0.85,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"text_columns_analyzed": len(text_cols), "threats_found": len(findings)},
        )

    def _check_data_integrity(self, df: pd.DataFrame) -> DetectionResult:
        """Check data integrity issues."""
        findings = []
        risk_score = 0

        # Check for missing values
        missing = df.isnull().sum()
        if missing.sum() > 0:
            high_missing = missing[missing > len(df) * 0.3]
            for col in high_missing.index:
                pct = (missing[col] / len(df)) * 100
                findings.append(f"Column '{col}': {pct:.1f}% missing values")
                risk_score += 0.1

        # Check for duplicates
        duplicates = df.duplicated().sum()
        dup_pct = (duplicates / len(df)) * 100
        if dup_pct > 5:
            findings.append(f"Dataset: {dup_pct:.1f}% duplicate rows")
            risk_score += 0.15

        # Check for near-duplicates (same values in most columns)
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0 and len(df) > 10:
            # Sample check for near-duplicates
            sample = df[numeric_cols].head(100)
            distances = pd.DataFrame(sample).iloc[:-1].values - pd.DataFrame(sample).iloc[1:].values
            near_dup = (distances == 0).all(axis=1).sum()
            if near_dup > len(sample) * 0.1:
                findings.append(f"Dataset: High similarity between consecutive rows (suspicious)")
                risk_score += 0.2

        return DetectionResult(
            technique=DetectionTechniqueType.INTEGRITY_CHECK,
            passed=risk_score == 0,
            confidence=0.90,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"duplicate_count": duplicates, "missing_values": missing.sum()},
        )

    def _analyze_correlations(self, df: pd.DataFrame) -> DetectionResult:
        """Analyze feature correlations for anomalies."""
        findings = []
        risk_score = 0

        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) < 2:
            return DetectionResult(
                technique=DetectionTechniqueType.CORRELATION_ANALYSIS,
                passed=True,
                confidence=0.3,
                findings=["Insufficient numeric columns for correlation analysis"],
                risk_score=0,
                metrics={},
            )

        try:
            corr_matrix = df[numeric_cols].corr()

            # Find perfect correlations (suspicious)
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    corr_val = abs(corr_matrix.iloc[i, j])
                    if corr_val > 0.99:  # Nearly perfect correlation
                        col1, col2 = corr_matrix.columns[i], corr_matrix.columns[j]
                        findings.append(f"Perfect correlation between '{col1}' and '{col2}' ({corr_val:.3f})")
                        risk_score += 0.15

        except Exception as e:
            logger.debug(f"Correlation analysis error: {e}")

        return DetectionResult(
            technique=DetectionTechniqueType.CORRELATION_ANALYSIS,
            passed=risk_score == 0,
            confidence=0.75,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"numeric_columns_analyzed": len(numeric_cols)},
        )

    def _analyze_metadata(self, df: pd.DataFrame) -> DetectionResult:
        """Analyze dataset metadata."""
        findings = []
        risk_score = 0

        # Check column names for suspicious patterns
        suspicious_patterns = ["__", "xxx", "test", "tmp", "debug"]
        for col in df.columns:
            col_lower = col.lower()
            for pattern in suspicious_patterns:
                if pattern in col_lower:
                    findings.append(f"Suspicious column name: '{col}'")
                    risk_score += 0.05

        # Check for excessive number of columns
        if len(df.columns) > 1000:
            findings.append(f"Excessive number of columns: {len(df.columns)}")
            risk_score += 0.1

        # Check data types consistency
        dtypes = df.dtypes.value_counts()
        if len(dtypes) > 10:
            findings.append(f"Too many different data types: {len(dtypes)}")
            risk_score += 0.1

        return DetectionResult(
            technique=DetectionTechniqueType.METADATA_ANALYSIS,
            passed=risk_score == 0,
            confidence=0.70,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"columns": len(df.columns), "dtypes": len(dtypes)},
        )

    def _detect_sample_patterns(self, df: pd.DataFrame) -> DetectionResult:
        """Detect suspicious sample patterns."""
        findings = []
        risk_score = 0

        if len(df) < 2:
            return DetectionResult(
                technique=DetectionTechniqueType.SAMPLE_PATTERNS,
                passed=True,
                confidence=0.2,
                findings=[],
                risk_score=0,
                metrics={},
            )

        # Check for repeated samples
        repeated = df.duplicated(keep=False).sum()
        repeated_pct = (repeated / len(df)) * 100
        if repeated_pct > 10:
            findings.append(f"High repetition rate: {repeated_pct:.1f}% repeated samples")
            risk_score += 0.2

        # Check for sequential patterns
        if len(df) > 10:
            # Check if indices seem artificially ordered
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) > 0:
                for col in numeric_cols:
                    diffs = df[col].diff().dropna()
                    if len(diffs) > 0:
                        # Check if differences are constant (synthetic data)
                        unique_diffs = len(diffs.unique())
                        if unique_diffs <= 3 and diffs.std() < 0.001:
                            findings.append(f"Column '{col}': Suspiciously constant increments (synthetic?)")
                            risk_score += 0.15

        return DetectionResult(
            technique=DetectionTechniqueType.SAMPLE_PATTERNS,
            passed=risk_score == 0,
            confidence=0.75,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"repeated_samples": repeated},
        )

    def _test_distributions(self, df: pd.DataFrame) -> DetectionResult:
        """Test statistical distributions."""
        findings = []
        risk_score = 0

        numeric_cols = df.select_dtypes(include=[np.number]).columns

        for col in numeric_cols:
            data = df[col].dropna()
            if len(data) < 30:  # Need minimum samples for tests
                continue

            try:
                # Shapiro-Wilk test for normality
                stat, p_value = stats.shapiro(data)
                if p_value > 0.05:  # Likely normal
                    pass  # Normal distribution is expected for many features
                else:
                    # Check for uniform distribution
                    ks_stat, ks_p = stats.kstest(data, "uniform", args=(data.min(), data.max()))
                    if ks_p < 0.05:
                        # Neither normal nor uniform - could be suspicious
                        pass

                # Check for Benford's law (for positive integers)
                if (data > 0).all() and (data == data.astype(int)).all():
                    first_digits = (data.astype(str).str[0]).astype(int)
                    expected = [np.log10(1 + 1/d) for d in range(1, 10)]
                    observed = [sum(first_digits == d) / len(first_digits) for d in range(1, 10)]
                    chi2, p_val = stats.chisquare(observed, expected)
                    if p_val < 0.05:
                        findings.append(f"Column '{col}': Possible Benford's Law violation")
                        risk_score += 0.1

            except Exception as e:
                logger.debug(f"Distribution test error on {col}: {e}")

        return DetectionResult(
            technique=DetectionTechniqueType.DISTRIBUTION_TESTS,
            passed=risk_score == 0,
            confidence=0.70,
            findings=findings,
            risk_score=min(1.0, risk_score),
            metrics={"numeric_columns_tested": len(numeric_cols)},
        )

    def _find_suspicious_samples(self, df: pd.DataFrame, detection_results: List[DetectionResult]) -> List[SuspiciousSample]:
        """Identify suspicious samples."""
        suspicious = []

        # If integrity check found near-duplicates, flag those samples
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0 and len(df) > 2:
            try:
                # Check for highly similar consecutive rows
                data_matrix = df[numeric_cols].fillna(0).values
                for i in range(len(data_matrix) - 1):
                    similarity = np.allclose(data_matrix[i], data_matrix[i + 1], atol=0.001)
                    if similarity:
                        suspicious.append(
                            SuspiciousSample(
                                sample_index=i,
                                suspicious_features=list(numeric_cols),
                                anomaly_score=0.9,
                                reason="Nearly identical to next sample",
                            )
                        )
            except:
                pass

        return suspicious

    def _assess_risk(
        self, detection_results: List[DetectionResult], suspicious_samples: List[SuspiciousSample], total_samples: int
    ) -> Tuple[float, DatasetVerdictType, float, str]:
        """Assess overall risk and generate verdict."""
        # Calculate average risk score
        if detection_results:
            avg_risk = np.mean([r.risk_score for r in detection_results])
        else:
            avg_risk = 0

        # Factor in suspicious sample ratio
        if total_samples > 0:
            suspicious_ratio = len(suspicious_samples) / total_samples
            avg_risk = (avg_risk * 0.8) + (min(1.0, suspicious_ratio) * 0.2)

        # Generate verdict
        if avg_risk > 0.7:
            verdict = DatasetVerdictType.UNSAFE
            confidence = 0.85
            explanation = "Dataset shows multiple poisoning indicators. Strong evidence of data poisoning detected."
        elif avg_risk > 0.5:
            verdict = DatasetVerdictType.SUSPICIOUS
            confidence = 0.75
            explanation = "Dataset has several suspicious characteristics. Manual review recommended."
        elif avg_risk > 0.3:
            verdict = DatasetVerdictType.SUSPICIOUS
            confidence = 0.65
            explanation = "Dataset has minor anomalies detected. Proceed with caution."
        else:
            verdict = DatasetVerdictType.SAFE
            confidence = 0.80
            explanation = "Dataset appears clean. No significant poisoning indicators detected."

        return avg_risk, verdict, confidence, explanation

    def _generate_recommendation(self, verdict: DatasetVerdictType, risk_score: float) -> str:
        """Generate security recommendation."""
        if verdict == DatasetVerdictType.UNSAFE:
            return "🔴 DO NOT USE: Dataset shows clear signs of poisoning. Investigate source immediately."
        elif verdict == DatasetVerdictType.SUSPICIOUS:
            if risk_score > 0.5:
                return "🟠 USE WITH EXTREME CAUTION: Conduct thorough review before production use."
            else:
                return "🟡 PROCEED WITH CAUTION: Monitor model behavior carefully."
        else:
            return "🟢 SAFE: Appears suitable for use. Apply standard data handling practices."

    def _build_summary_metrics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Build summary statistics."""
        return {
            "total_samples": len(df),
            "total_features": len(df.columns),
            "memory_usage_mb": df.memory_usage(deep=True).sum() / 1024 / 1024,
            "missing_values_pct": (df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100,
            "duplicate_rows": df.duplicated().sum(),
            "numeric_columns": len(df.select_dtypes(include=[np.number]).columns),
            "categorical_columns": len(df.select_dtypes(include=["object"]).columns),
        }

    def get_analysis_result(self, analysis_id: str) -> Optional[DatasetAnalysisResult]:
        """Retrieve a previously computed analysis."""
        return self.analysis_results.get(analysis_id)


# Global instance
_detector_instance: Optional[DatasetPoisoningDetector] = None


def get_detector() -> DatasetPoisoningDetector:
    """Get or create the global detector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = DatasetPoisoningDetector()
    return _detector_instance
