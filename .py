# dataset/preprocess_dataset.py
import arff
import numpy as np
import json
from sklearn.model_selection import train_test_split
import os

def preprocess_dataset():
    try:
        # Load the dataset - handle file not found error
        if not os.path.exists('dataset.arff'):
            print("Error: dataset.arff not found. Please ensure the dataset file is in the current directory.")
            return
        
        print("Loading dataset...")
        with open('dataset.arff', 'r') as f:
            dataset = arff.load(f)
        
        data = np.array(dataset['data'])
        print(f"The dataset has {data.shape[0]} datapoints with {data.shape[1]-1} features")
        print(f"Features: {[feature[0] for feature in dataset['attributes']]}")
        
        # Select specific features (indices 0-16, 22, 24, 30) - ensure indices exist
        feature_indices = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 22, 24, 30]
        
        # Check if all indices exist in dataset
        max_index = max(feature_indices)
        if max_index >= data.shape[1]:
            print(f"Error: Feature index {max_index} is out of range. Dataset has only {data.shape[1]} columns.")
            # Use available columns instead
            feature_indices = list(range(min(19, data.shape[1]-1)))  # Use first 18 features or all available
            print(f"Using available feature indices: {feature_indices}")
        
        # Extract features and target
        selected_data = data[:, feature_indices + [-1]]  # Features + target column
        X, y = selected_data[:, :-1], selected_data[:, -1]
        
        print('Before splitting:')
        print(f"X: {X.shape}, y: {y.shape}")
        
        # Convert to numeric and handle missing values
        X = X.astype(float)
        
        # Replace any NaN or inf values with 0
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Ensure y contains only valid class labels
        unique_classes = np.unique(y)
        print(f"Classes in dataset: {unique_classes}")
        
        # Split the data into training and test sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        
        print('After splitting:')
        print(f"X_train: {X_train.shape}, y_train: {y_train.shape}")
        print(f"X_test: {X_test.shape}, y_test: {y_test.shape}")
        
        # Create output directory if it doesn't exist
        os.makedirs('processed_data', exist_ok=True)
        
        # Save data to .npy files
        np.save('processed_data/X_train55.npy', X_train)
        np.save('processed_data/X_test55.npy', X_test)
        np.save('processed_data/y_train55.npy', y_train)
        np.save('processed_data/y_test55.npy', y_test)
        print('Saved preprocessed data to processed_data/ directory!')
        
        # Save test data as JSON
        test_data = {
            'X_test55': X_test.tolist(),
            'y_test55': y_test.tolist(),
            'feature_count': X_test.shape[1],
            'sample_count': X_test.shape[0]
        }
        
        with open('processed_data/testdata55.json', 'w') as tdfile:
            json.dump(test_data, tdfile, indent=2)
        print('Test Data written to processed_data/testdata55.json')
        
        # Print summary statistics
        print(f"\nDataset Summary:")
        print(f"Total samples: {X.shape[0]}")
        print(f"Features: {X.shape[1]}")
        print(f"Training samples: {X_train.shape[0]}")
        print(f"Test samples: {X_test.shape[0]}")
        print(f"Class distribution in training set: {np.unique(y_train, return_counts=True)}")
        
    except Exception as e:
        print(f"Error processing dataset: {str(e)}")
        raise

if __name__ == "__main__":
    preprocess_dataset()
