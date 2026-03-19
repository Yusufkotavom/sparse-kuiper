# Video Concat Tests

This directory contains unit tests and property-based tests for the video-concat feature.

## Setup

Install test dependencies:

```bash
pip install pytest hypothesis
```

Or install from requirements.txt (which includes these dependencies):

```bash
pip install -r backend/requirements.txt
```

## Running Tests

### Run all tests:

```bash
python -m pytest backend/tests/ -v
```

### Run unit tests only:

```bash
python -m pytest backend/tests/test_concat_api.py -v
```

### Run property tests only:

```bash
python -m pytest backend/tests/test_concat_properties.py -v
```

### Run a specific test class:

```bash
python -m pytest backend/tests/test_concat_api.py::TestConcatRunEndpoint -v
```

### Run a specific test:

```bash
python -m pytest backend/tests/test_concat_api.py::TestConcatRunEndpoint::test_run_returns_job_id_with_valid_config -v
```

### Run with coverage:

```bash
python -m pytest backend/tests/ --cov=backend.routers.concat --cov=backend.services.concat_worker --cov-report=html
```

## Test Structure

### Unit Tests (`test_concat_api.py`)

Unit tests verify specific API endpoint behaviors using FastAPI TestClient.

**Test Classes:**

1. **TestConcatRunEndpoint** - Tests for POST /api/v1/concat/run
   - Validates: Requirements 4.1, 11.10
   - Tests valid configuration returns job_id
   - Tests error handling (404, 400, 422)
   - Tests path traversal prevention
   - Tests background music integration

2. **TestConcatStatusEndpoint** - Tests for GET /api/v1/concat/status/{job_id}
   - Validates: Requirements 4.3
   - Tests correct job status retrieval
   - Tests completed job with output_path
   - Tests error job with error message
   - Tests 404 for nonexistent job

3. **TestConcatCancelEndpoint** - Tests for POST /api/v1/concat/cancel/{job_id}
   - Validates: Requirements 4.8
   - Tests cancel_requested flag is set
   - Tests cancellation of pending/running jobs
   - Tests appropriate messages for completed/error jobs
   - Tests 404 for nonexistent job

4. **TestConcatFileInfoEndpoint** - Tests for GET /api/v1/concat/file-info
   - Validates: Requirements 11.10
   - Tests video metadata retrieval
   - Tests 404 for nonexistent files
   - Tests 500 when ffprobe fails
   - Tests path traversal prevention
   - Tests path normalization

5. **TestConcatErrorHandling** - Tests for error handling across endpoints
   - Validates: Requirements 4.1
   - Tests missing required fields
   - Tests invalid parameter values
   - Tests validation errors

### Property-Based Tests (`test_concat_properties.py`)

Property-based tests verify universal properties that should hold across all valid inputs using Hypothesis.

**Current Tests:**

1. **Property 10: Job ID Uniqueness** (`test_property_10_job_id_uniqueness`)
   - Validates: Requirements 4.1, 9.3
   - Tests that for any set of concat operations started simultaneously (2-20 jobs), all job IDs are unique
   - Runs 100 test iterations with randomized job counts

## Test Configuration

- **Test Framework**: pytest
- **Property Testing**: Hypothesis
- **HTTP Testing**: FastAPI TestClient
- **Max Examples**: 100 iterations per property test
- **Job Count Range**: 2-20 concurrent jobs

## Adding New Tests

### Adding Unit Tests

When adding new unit tests:

1. Follow the naming convention: `test_<endpoint>_<behavior>`
2. Group related tests in test classes
3. Include the requirements being validated in docstrings
4. Use fixtures for common setup (temp directories, mock data)
5. Clear the JOBS registry using the `clear_jobs` fixture

Example:

```python
def test_endpoint_behavior(self, client, temp_project_dir):
    """
    Test description
    Validates: Requirements X.Y
    """
    with patch("backend.routers.concat.VIDEO_PROJECTS_DIR", temp_project_dir.parent):
        response = client.post("/api/v1/concat/run", json=payload)
        assert response.status_code == 200
```

### Adding Property Tests

When adding new property tests:

1. Follow the naming convention: `test_property_<number>_<description>`
2. Include the property number and description in the docstring
3. Reference the requirements being validated
4. Use `@settings(max_examples=100)` for consistent test coverage
5. Clear the JOBS registry at the start of each test iteration if testing job creation

Example:

```python
@settings(max_examples=100)
@given(param=st.integers(min_value=1, max_value=10))
def test_property_X_description(self, param: int):
    """
    **Validates: Requirements X.Y**
    
    Feature: video-concat, Property X: Description
    
    Property description here.
    """
    # Clear state if needed
    JOBS.clear()
    
    # Test implementation
    pass
```
