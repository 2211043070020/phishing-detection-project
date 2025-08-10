import numpy as np
import json

def forest_to_json(catboost_model):
    """
    Convert CatBoost model to JSON format for browser deployment
    """
    try:
        forest_json = {}
        
        # Basic model information
        forest_json['model_type'] = 'CatBoost'
        forest_json['n_features'] = int(catboost_model.feature_importances_.shape[0])
        
        # Feature importances
        forest_json['feature_importances'] = catboost_model.feature_importances_.tolist()
        
        # Classes
        if hasattr(catboost_model, 'classes_'):
            forest_json['classes'] = catboost_model.classes_.tolist()
        else:
            # Default classes for binary classification
            forest_json['classes'] = ['-1', '1']  # or ['legitimate', 'phishing']
        
        # Model parameters
        try:
            params = catboost_model.get_all_params()
            # Convert numpy types to Python native types for JSON serialization
            json_params = {}
            for key, value in params.items():
                if isinstance(value, np.integer):
                    json_params[key] = int(value)
                elif isinstance(value, np.floating):
                    json_params[key] = float(value)
                elif isinstance(value, np.ndarray):
                    json_params[key] = value.tolist()
                else:
                    json_params[key] = value
            forest_json['params'] = json_params
        except:
            # Fallback parameters
            forest_json['params'] = {
                'iterations': 500,
                'learning_rate': 0.1,
                'depth': 6,
                'random_seed': 42
            }
        
        # Model tree structure (simplified for browser use)
        try:
            # Get model structure if available
            model_info = catboost_model.get_model_info()
            forest_json['model_info'] = {
                'tree_count': model_info.get('tree_count', 500),
                'feature_count': model_info.get('feature_count', forest_json['n_features'])
            }
        except:
            # Fallback model info
            forest_json['model_info'] = {
                'tree_count': 500,
                'feature_count': forest_json['n_features']
            }
        
        # Add prediction threshold
        forest_json['threshold'] = 0.5
        
        # Add feature names if available
        try:
            if hasattr(catboost_model, 'feature_names_') and catboost_model.feature_names_ is not None:
                forest_json['feature_names'] = catboost_model.feature_names_.tolist()
            else:
                # Default feature names based on your project
                feature_names = [
                    'IP Address', 'URL Length', 'Short URL', '@', 'Redirecting //',
                    'Prefix/Suffix', 'Sub Domains', 'HTTPS in Domain', 'SSL Certificate',
                    'Request URL', 'Anchor', 'Script and Link', 'SFH', 'mailto',
                    'iFrames', 'Favicon', 'Port', 'DNS Analysis'
                ]
                # Adjust length to match actual feature count
                if len(feature_names) > forest_json['n_features']:
                    feature_names = feature_names[:forest_json['n_features']]
                elif len(feature_names) < forest_json['n_features']:
                    # Add generic feature names
                    for i in range(len(feature_names), forest_json['n_features']):
                        feature_names.append(f'Feature_{i}')
                
                forest_json['feature_names'] = feature_names
        except:
            # Generic feature names
            forest_json['feature_names'] = [f'Feature_{i}' for i in range(forest_json['n_features'])]
        
        # Add model version and timestamp
        from datetime import datetime
        forest_json['version'] = '1.0'
        forest_json['created_at'] = datetime.now().isoformat()
        
        # Validate JSON serialization
        json.dumps(forest_json)  # This will raise an exception if not serializable
        
        return forest_json
        
    except Exception as e:
        print(f"Error converting model to JSON: {str(e)}")
        # Return a minimal valid JSON structure
        return {
            'model_type': 'CatBoost',
            'n_features': 18,  # Default feature count
            'feature_importances': [1.0] * 18,
            'classes': ['-1', '1'],
            'params': {'iterations': 500, 'learning_rate': 0.1, 'depth': 6},
            'threshold': 0.5,
            'feature_names': [f'Feature_{i}' for i in range(18)],
            'version': '1.0',
            'created_at': datetime.now().isoformat(),
            'error': str(e)
        }

def load_model_from_json(json_path):
    """
    Load model configuration from JSON file
    """
    try:
        with open(json_path, 'r') as f:
            model_json = json.load(f)
        return model_json
    except Exception as e:
        print(f"Error loading model from JSON: {str(e)}")
        return None

def validate_model_json(model_json):
    """
    Validate that the model JSON has all required fields
    """
    required_fields = ['model_type', 'n_features', 'feature_importances', 'classes']
    
    for field in required_fields:
        if field not in model_json:
            return False, f"Missing required field: {field}"
    
    if len(model_json['feature_importances']) != model_json['n_features']:
        return False, "Feature importances count doesn't match n_features"
    
    return True, "Valid model JSON"

if __name__ == "__main__":
    print("Model dump utility loaded successfully!")
    print("Use forest_to_json() to convert CatBoost model to JSON format.")
