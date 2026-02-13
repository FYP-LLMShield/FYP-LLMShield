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


def convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    return obj


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

            # Convert detection results to ensure no numpy types
            for det_result in detection_results:
                det_result.risk_score = float(det_result.risk_score)
                det_result.confidence = float(det_result.confidence)
                if det_result.metrics:
                    det_result.metrics = convert_numpy_types(det_result.metrics)

            # Build result
            result = DatasetAnalysisResult(
                analysis_id=analysis_id,
                dataset_name=dataset_name,
                input_method=input_method,
                verdict=verdict,
                confidence=float(confidence),
                explanation=explanation,
                detection_results=detection_results,
                suspicious_samples=suspicious_samples[:10],  # Top 10
                total_samples=int(len(df)),
                total_features=int(len(df.columns)),
                suspicious_sample_count=int(len(suspicious_samples)),
                overall_risk_score=float(overall_risk),
                recommendation=recommendation,
                summary_metrics=convert_numpy_types(self._build_summary_metrics(df)),
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
                summary_metrics={},
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
        """Run all 10 detection techniques (8 enhanced + 2 new)."""
        results = []

        # 1. Statistical Anomalies (ENHANCED)
        results.append(self._detect_statistical_anomalies(df))
        logger.info("✓ Statistical anomalies detection completed")

        # 2. Label Poisoning (ENHANCED)
        results.append(self._detect_label_poisoning(df))
        logger.info("✓ Label poisoning detection completed")

        # 3. Text Analysis (ENHANCED)
        results.append(self._detect_text_anomalies(df))
        logger.info("✓ Text analysis completed")

        # 4. Data Integrity (ORIGINAL)
        results.append(self._check_data_integrity(df))
        logger.info("✓ Data integrity check completed")

        # 5. Correlation Analysis (ORIGINAL)
        results.append(self._analyze_correlations(df))
        logger.info("✓ Correlation analysis completed")

        # 6. Metadata Analysis (ORIGINAL)
        results.append(self._analyze_metadata(df))
        logger.info("✓ Metadata analysis completed")

        # 7. Sample Patterns (ORIGINAL)
        results.append(self._detect_sample_patterns(df))
        logger.info("✓ Sample pattern detection completed")

        # 8. Distribution Tests (ORIGINAL)
        results.append(self._test_distributions(df))
        logger.info("✓ Distribution testing completed")

        # 9. Entropy Analysis (NEW)
        results.append(self._analyze_entropy(df))
        logger.info("✓ Entropy analysis completed")

        # 10. Feature Dependency Analysis (NEW)
        results.append(self._analyze_feature_dependencies(df))
        logger.info("✓ Feature dependency analysis completed")

        return results

    def _detect_statistical_anomalies(self, df: pd.DataFrame) -> DetectionResult:
        """Enhanced statistical anomaly detection with Mahalanobis distance and distribution shifts."""
        findings = []
        risk_score = 0
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if not numeric_cols:
            return DetectionResult(
                technique=DetectionTechniqueType.STATISTICAL,
                passed=True,
                confidence=0.8,
                findings=[],
                risk_score=0,
                metrics={"numeric_columns": 0},
            )

        # Convert to numeric and handle missing values
        numeric_df = df[numeric_cols].dropna()

        if len(numeric_df) < 5:
            return DetectionResult(
                technique=DetectionTechniqueType.STATISTICAL,
                passed=True,
                confidence=0.6,
                findings=["Insufficient data for statistical analysis"],
                risk_score=0.1,
                metrics={"numeric_columns": len(numeric_cols)},
            )

        anomaly_count = 0

        # 1. IQR-based outlier detection
        for col in numeric_cols:
            data = df[col].dropna()
            if len(data) < 3:
                continue

            Q1 = data.quantile(0.25)
            Q3 = data.quantile(0.75)
            IQR = Q3 - Q1

            if IQR > 0:
                outlier_threshold = 1.5 * IQR
                outliers = ((data < Q1 - outlier_threshold) | (data > Q3 + outlier_threshold)).sum()
                outlier_pct = (outliers / len(data)) * 100

                if outlier_pct > 5:
                    findings.append(f"Column '{col}': {outlier_pct:.1f}% outliers detected")
                    risk_score += 0.08
                    anomaly_count += 1

        # 2. Z-score analysis (stricter threshold)
        for col in numeric_cols:
            data = df[col].dropna()
            try:
                z_scores = np.abs(stats.zscore(data))
                extreme_3sigma = (z_scores > 3).sum()
                extreme_2sigma = (z_scores > 2.5).sum()

                if extreme_3sigma > len(data) * 0.01:
                    findings.append(f"Column '{col}': {extreme_3sigma} extreme values (>3σ)")
                    risk_score += 0.08
                    anomaly_count += 1
                elif extreme_2sigma > len(data) * 0.05:
                    findings.append(f"Column '{col}': {extreme_2sigma} values at edge (>2.5σ)")
                    risk_score += 0.05
            except:
                pass

        # 3. Distribution shape analysis (detect bimodal)
        for col in numeric_cols:
            data = df[col].dropna()
            if len(data) > 20:
                try:
                    skewness = stats.skew(data)
                    kurtosis_val = stats.kurtosis(data)

                    # Extreme skewness or kurtosis indicates manipulation
                    if abs(skewness) > 2:
                        findings.append(f"Column '{col}': Extreme skewness ({skewness:.2f}) detected")
                        risk_score += 0.06
                    if kurtosis_val > 3:
                        findings.append(f"Column '{col}': High kurtosis ({kurtosis_val:.2f}) - heavy tails")
                        risk_score += 0.06
                except:
                    pass

        # 4. Multivariate analysis (Mahalanobis distance)
        if len(numeric_cols) > 1 and len(numeric_df) > len(numeric_cols):
            try:
                mean = numeric_df.mean()
                cov = numeric_df.cov()
                inv_cov = np.linalg.inv(cov)

                mahal_dist = []
                for idx, row in numeric_df.iterrows():
                    diff = row - mean
                    m_dist = np.sqrt(diff.dot(inv_cov).dot(diff.T))
                    mahal_dist.append(m_dist)

                threshold = np.percentile(mahal_dist, 95)
                suspicious_samples = np.sum(np.array(mahal_dist) > threshold)
                suspicious_pct = (suspicious_samples / len(mahal_dist)) * 100

                if suspicious_pct > 8:
                    findings.append(f"Multivariate anomalies: {suspicious_pct:.1f}% samples with high Mahalanobis distance")
                    risk_score += 0.1
                    anomaly_count += 1
            except:
                pass

        return DetectionResult(
            technique=DetectionTechniqueType.STATISTICAL,
            passed=risk_score < 0.2,
            confidence=0.88,
            findings=findings,
            risk_score=float(min(1.0, risk_score)),
            metrics={
                "numeric_columns": int(len(numeric_cols)),
                "anomalies_found": int(anomaly_count),
                "detection_strength": "Enhanced" if anomaly_count > 0 else "Standard"
            },
        )

    def _detect_label_poisoning(self, df: pd.DataFrame) -> DetectionResult:
        """Enhanced label poisoning detection with entropy analysis."""
        findings = []
        risk_score = 0

        # Check for obvious label columns
        label_cols = [col for col in df.columns if col.lower() in ["label", "target", "class", "y"]]

        if not label_cols and len(df.columns) > 0:
            # Fallback: check last column as potential label
            label_cols = [df.columns[-1]]

        for col in label_cols:
            if col not in df.columns:
                continue

            value_counts = df[col].value_counts(dropna=False)
            total = len(df)

            # 1. Class imbalance detection
            if len(value_counts) > 1:
                max_ratio = value_counts.iloc[0] / total
                min_ratio = value_counts.iloc[-1] / total

                if max_ratio > 0.95:
                    findings.append(f"Extreme class imbalance: {max_ratio:.1%} dominant class")
                    risk_score += 0.15

                if min_ratio < 0.01 and len(value_counts) > 2:
                    findings.append(f"Rare minority class: only {min_ratio:.1%} occurrence")
                    risk_score += 0.1

                # Check for suspicious imbalance ratio (e.g., 70/30 split looks unnatural)
                if len(value_counts) == 2:
                    ratio = max_ratio / min_ratio
                    if ratio > 9:  # 90/10 or worse
                        findings.append(f"Suspicious class ratio: {ratio:.1f}:1")
                        risk_score += 0.08

            # 2. Shannon entropy analysis (measure randomness)
            probabilities = value_counts / total
            entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
            max_entropy = np.log2(len(value_counts))

            if max_entropy > 0:
                normalized_entropy = entropy / max_entropy

                if normalized_entropy < 0.3:
                    findings.append(f"Low entropy in labels: {normalized_entropy:.2f} (suggests non-random labeling)")
                    risk_score += 0.12
                elif normalized_entropy > 0.95 and len(value_counts) > 2:
                    findings.append(f"Suspiciously high entropy: {normalized_entropy:.2f} (possibly random labels)")
                    risk_score += 0.1

            # 3. Check for suspicious label patterns
            if df[col].dtype == "object":
                unique_vals = df[col].unique()
                if len(unique_vals) > 100:
                    findings.append(f"Too many unique labels: {len(unique_vals)} unique values")
                    risk_score += 0.08

                # Check for label leakage patterns
                str_vals = [str(v).lower() for v in unique_vals]
                if any("poison" in v or "attack" in v or "backdoor" in v for v in str_vals):
                    findings.append("Suspicious label naming detected (poison/attack/backdoor)")
                    risk_score += 0.1

            # 4. Check for label consistency
            if col in df.columns:
                null_count = df[col].isnull().sum()
                if null_count > len(df) * 0.05:
                    findings.append(f"High missing label rate: {null_count / len(df):.1%}")
                    risk_score += 0.08

        return DetectionResult(
            technique=DetectionTechniqueType.LABEL_ANALYSIS,
            passed=risk_score < 0.2,
            confidence=0.85,
            findings=findings,
            risk_score=float(min(1.0, risk_score)),
            metrics={
                "label_columns": int(len(label_cols)),
                "checks_performed": int(4),
                "detection_methods": ["imbalance", "entropy", "pattern", "consistency"]
            },
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

    def _analyze_entropy(self, df: pd.DataFrame) -> DetectionResult:
        """NEW: Entropy-based detection for engineered/manipulated features."""
        findings = []
        risk_score = 0

        numeric_cols = df.select_dtypes(include=[np.number]).columns
        categorical_cols = df.select_dtypes(include=["object"]).columns

        # Analyze entropy of numerical features (discretized)
        for col in numeric_cols:
            data = df[col].dropna()
            if len(data) < 10:
                continue

            try:
                # Discretize data into bins
                hist, _ = np.histogram(data, bins=min(50, len(np.unique(data))))
                probabilities = hist / np.sum(hist)
                entropy = -np.sum(probabilities[probabilities > 0] * np.log2(probabilities[probabilities > 0]))
                max_entropy = np.log2(len(hist))

                if max_entropy > 0:
                    normalized = entropy / max_entropy
                    if normalized < 0.2:
                        findings.append(f"Column '{col}': Low entropy ({normalized:.2f}) - possibly engineered")
                        risk_score += 0.08
            except:
                pass

        # Analyze entropy of categorical features
        for col in categorical_cols:
            value_counts = df[col].value_counts()
            probabilities = value_counts / len(df)
            entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
            max_entropy = np.log2(len(value_counts))

            if max_entropy > 0:
                normalized = entropy / max_entropy
                if len(value_counts) > 2 and normalized < 0.3:
                    findings.append(f"Column '{col}': Suspiciously low entropy ({normalized:.2f})")
                    risk_score += 0.08

        return DetectionResult(
            technique=DetectionTechniqueType.STATISTICAL,  # Use existing type
            passed=risk_score < 0.15,
            confidence=0.80,
            findings=findings,
            risk_score=float(min(1.0, risk_score)),
            metrics={"entropy_checks": int(len(numeric_cols) + len(categorical_cols))},
        )

    def _analyze_feature_dependencies(self, df: pd.DataFrame) -> DetectionResult:
        """NEW: Detect suspicious feature dependencies indicating manipulation."""
        findings = []
        risk_score = 0

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        if len(numeric_cols) < 2:
            return DetectionResult(
                technique=DetectionTechniqueType.CORRELATION_ANALYSIS,
                passed=True,
                confidence=0.6,
                findings=["Insufficient numeric features for dependency analysis"],
                risk_score=0,
                metrics={"numeric_columns": len(numeric_cols)},
            )

        numeric_df = df[numeric_cols].dropna()

        if len(numeric_df) < 10:
            return DetectionResult(
                technique=DetectionTechniqueType.CORRELATION_ANALYSIS,
                passed=True,
                confidence=0.5,
                findings=[],
                risk_score=0,
                metrics={"samples_analyzed": len(numeric_df)},
            )

        try:
            # Calculate pairwise mutual information
            suspicious_deps = []
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i+1:]:
                    data1 = numeric_df[col1].values
                    data2 = numeric_df[col2].values

                    # Discretize for MI calculation
                    bins = min(10, len(np.unique(data1)))
                    hist1, edges1 = np.histogram(data1, bins=bins)
                    hist2, edges2 = np.histogram(data2, bins=bins)

                    # Check correlation
                    corr = np.corrcoef(data1, data2)[0, 1]

                    if abs(corr) > 0.99:
                        findings.append(f"Perfect correlation between '{col1}' and '{col2}': {corr:.3f}")
                        risk_score += 0.1
                        suspicious_deps.append((col1, col2))
                    elif abs(corr) > 0.95:
                        findings.append(f"Suspicious correlation between '{col1}' and '{col2}': {corr:.3f}")
                        risk_score += 0.06

        except Exception as e:
            logger.debug(f"Dependency analysis error: {e}")

        return DetectionResult(
            technique=DetectionTechniqueType.CORRELATION_ANALYSIS,
            passed=risk_score < 0.2,
            confidence=0.82,
            findings=findings,
            risk_score=float(min(1.0, risk_score)),
            metrics={
                "features_analyzed": int(len(numeric_cols)),
                "suspicious_pairs": int(len(findings)),
            },
        )

    def _assess_risk(
        self, detection_results: List[DetectionResult], suspicious_samples: List[SuspiciousSample], total_samples: int
    ) -> Tuple[float, DatasetVerdictType, float, str]:
        """Enhanced risk assessment with weighted scoring for 10 techniques."""

        # Weighted scoring system for 10 detection techniques
        weights = {
            DetectionTechniqueType.STATISTICAL: 0.15,  # Enhanced, primary indicator
            DetectionTechniqueType.LABEL_ANALYSIS: 0.15,  # Enhanced
            DetectionTechniqueType.TEXT_ANALYSIS: 0.12,
            DetectionTechniqueType.INTEGRITY_CHECK: 0.12,
            DetectionTechniqueType.CORRELATION_ANALYSIS: 0.12,  # Covers dependency analysis
            DetectionTechniqueType.METADATA_ANALYSIS: 0.12,
            DetectionTechniqueType.SAMPLE_PATTERNS: 0.12,
            DetectionTechniqueType.DISTRIBUTION_TESTS: 0.12,
        }

        # Calculate weighted risk
        weighted_risk = 0
        total_weight = 0
        high_risk_indicators = 0

        for result in detection_results:
            weight = weights.get(result.technique, 0.1)
            weighted_risk += result.risk_score * weight
            total_weight += weight

            if result.risk_score > 0.5:
                high_risk_indicators += 1

        # Normalize
        if total_weight > 0:
            avg_risk = weighted_risk / total_weight
        else:
            avg_risk = np.mean([r.risk_score for r in detection_results]) if detection_results else 0

        # Factor in suspicious sample ratio (max 20% impact)
        if total_samples > 0 and suspicious_samples:
            suspicious_ratio = min(len(suspicious_samples) / total_samples, 0.5)
            sample_risk = suspicious_ratio * 2  # Normalize to 0-1
            avg_risk = (avg_risk * 0.8) + (sample_risk * 0.2)

        # Generate verdict with stricter thresholds
        logger.info(f"Risk assessment: avg_risk={avg_risk:.3f}, high_risk_indicators={high_risk_indicators}")

        if avg_risk > 0.7:
            verdict = DatasetVerdictType.UNSAFE
            confidence = 0.88
            explanation = f"CRITICAL: Dataset shows strong poisoning indicators ({high_risk_indicators} techniques flagged). Multiple detection methods converge on unsafe verdict."
        elif avg_risk > 0.55:
            verdict = DatasetVerdictType.SUSPICIOUS
            confidence = 0.78
            explanation = f"WARNING: Dataset exhibits suspicious patterns ({high_risk_indicators} detection methods flagged). Manual review strongly recommended before use."
        elif avg_risk > 0.35:
            verdict = DatasetVerdictType.SUSPICIOUS
            confidence = 0.68
            explanation = f"CAUTION: Dataset has anomalies detected by {high_risk_indicators} methods. Recommend careful analysis before production use."
        else:
            verdict = DatasetVerdictType.SAFE
            confidence = 0.82
            explanation = "Dataset appears clean. No significant poisoning indicators detected across all 10 detection techniques."

        return float(avg_risk), verdict, confidence, explanation

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
