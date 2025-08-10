# model/train_model.py
from catboost import CatBoostClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import numpy as np
import json
import os
import sys

# Add the current directory to Python path to import dump55
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import dump55

def train_and_evaluate_model():
    try:
        # Define paths
        data_dir = '../dataset/processed_data' if os.path.exists('../dataset/processed_data') else 'processed_data'
        
        # Load training and test data
        print("Loading training and test data...")
        X_train = np.load(os.path.join(data_dir, 'X_train55.npy'))
        y_train = np.load(os.path.join(data_dir, 'y_train55.npy'))
        X_test = np.load(os.path.join(data_dir, 'X_test55.npy'))
        y_test = np.load(os.path.join(data_dir, 'y_test55.npy'))
        
        print(f"Training data shape: X_train: {X_train.shape}, y_train: {y_train.shape}")
        print(f"Test data shape: X_test: {X_test.shape}, y_test: {y_test.shape}")
        
        # Verify data integrity
        if np.any(np.isnan(X_train)) or np.any(np.isnan(X_test)):
            print("Warning: NaN values found in data. Replacing with 0.")
            X_train = np.nan_to_num(X_train)
            X_test = np.nan_to_num(X_test)
        
        # Initialize and train CatBoostClassifier with better parameters
        print("Initializing CatBoost model...")
        clf = CatBoostClassifier(
            iterations=500,
            learning_rate=0.1,
            depth=6,
            verbose=100,  # Show progress every 100 iterations
            random_seed=42,
            eval_metric='Accuracy',
            early_stopping_rounds=50
        )
        
        print("Training model...")
        clf.fit(
            X_train, y_train,
            eval_set=(X_test, y_test),
            plot=False
        )
        
        # Make predictions
        print("Making predictions...")
        y_pred = clf.predict(X_test)
        y_pred_proba = clf.predict_proba(X_test)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        print(f"\nModel Performance:")
        print(f"Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
        print(f"Precision: {precision:.4f} ({precision*100:.2f}%)")
        print(f"Recall: {recall:.4f} ({recall*100:.2f}%)")
        print(f"F1-Score: {f1:.4f} ({f1*100:.2f}%)")
        
        # Confusion Matrix
        cm = confusion_matrix(y_test, y_pred)
        print(f"\nConfusion Matrix:")
        print(cm)
        
        # Get feature importance and create a list of (index, importance) tuples
        feature_importances = clf.get_feature_importance()
        feature_importance_pairs = list(enumerate(feature_importances))
        
        # Sort by importance value (descending order)
        sorted_feature_importances = sorted(feature_importance_pairs, key=lambda x: x[1], reverse=True)
        
        # Print feature importances
        print(f"\nTop 10 Feature Importances:")
        print("Feature Index | Importance Value")
        print("-" * 35)
        for i, (idx, importance) in enumerate(sorted_feature_importances[:10]):
            print(f"Feature {idx:<10} | {importance:.6f}")
        
        # Create models directory if it doesn't exist
        os.makedirs('saved_models', exist_ok=True)
        
        # Save the model as JSON using custom dump logic
        print("\nSaving model...")
        model_json = dump55.forest_to_json(clf)
        
        with open('saved_models/classifier55.json', 'w') as f:
            json.dump(model_json, f, indent=2)
        print('Model saved to saved_models/classifier55.json')
        
        # Save model metadata
        metadata = {
            'model_type': 'CatBoost',
            'version': '1.0',
            'training_date': str(np.datetime64('now')),
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'feature_count': int(X_train.shape[1]),
            'training_samples': int(X_train.shape[0]),
            'test_samples': int(X_test.shape[0]),
            'classes': clf.classes_.tolist() if hasattr(clf, 'classes_') else ['legitimate', 'phishing']
        }
        
        with open('saved_models/model_metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)
        print('Model metadata saved to saved_models/model_metadata.json')
        
        # Save native CatBoost model for future use
        clf.save_model('saved_models/catboost_model.cbm')
        print('Native CatBoost model saved to saved_models/catboost_model.cbm')
        
        return clf, accuracy, precision, recall, f1
        
    except FileNotFoundError as e:
        print(f"Error: Required data files not found. {str(e)}")
        print("Please run the dataset preprocessing script first.")
        return None, None, None, None, None
    except Exception as e:
        print(f"Error training model: {str(e)}")
        raise

if __name__ == "__main__":
    model, acc, prec, rec, f1 = train_and_evaluate_model()
    if model is not None:
        print(f"\n✅ Model training completed successfully!")
        print(f"Final Accuracy: {acc*100:.2f}%")
